/**
 * REGRA 00 — INTEGRIDADE DO DADO EXIBIDO
 * CAMADA 2 — Confirmação por IV Rank / IV Percentile (Função Pura, sem I/O)
 *
 * Critérios:
 * 1. Buscar métricas de IV oficiais da Tastytrade (/market-metrics).
 * 2. Selecionar vencimento pelo Caso B (janela 30-45 DTE, preferência por mensal).
 * 3. Avaliar IV Rank e IV Percentile:
 *    - Fonte Única: tos-implied-volatility-index-rank e implied-volatility-percentile (escala 0-1 bruta).
 *    - Escala: multiplicada por 100 (raw * 100).
 *    - CORREÇÃO DE PRECISÃO COMPLETA (Ponto 3): A comparação (raw * 100 <= 30.0) é executada sem
 *      truncamento prévio. Truncamento ou formatação é restrito à exibição em tela.
 *    - Operador Lógico: AND estrito (IVR <= 30.0 E IVP <= 30.0).
 * 4. Regra de Falha: Se histórico de IV ou IVR/IVP não estiverem disponíveis, retorna INDISPONIVEL
 *    e descarta o candidato sumariamente (código: IV_HISTORY_UNAVAILABLE).
 */

import { Layer1Output, Layer2Output, SelectedExpiration } from '../types/low-vol-screener.types';
import { ExpirationOptionChainItem, selectExpirationCasoB } from './expiration-selector';

export interface CandidateOptionMetrics {
  rawIvr: number | null; // ex: 0.133828996 (fração 0-1)
  rawIvp: number | null; // ex: 0.090843054 (fração 0-1)
  atmIv: number | null; // ex: 0.285 (fração 0-1 ou 28.5%)
  expirations: ExpirationOptionChainItem[];
  source?: string;
}

export interface Layer2Config {
  maxIvRank?: number; // default 30.0
  maxIvPercentile?: number; // default 30.0
  minDte?: number; // default 30
  maxDte?: number; // default 45
}

const DEFAULT_LAYER2_CONFIG: Required<Layer2Config> = {
  maxIvRank: 30.0,
  maxIvPercentile: 30.0,
  minDte: 30,
  maxDte: 45,
};

const DEFAULT_EMPTY_EXPIRATION: SelectedExpiration = {
  expirationDate: '',
  dte: 0,
  selectionRule: 'CASO_B_SQUEEZE_GERAL',
  bufferDaysApplied: 0,
  isMonthlyStandard: false,
  provenance: 'INDISPONIVEL',
  source: 'none',
};

/**
 * Executa a filtragem pura da Camada 2 sobre os candidatos aprovados na Camada 1.
 */
export function processLayer2(
  layer1Results: Layer1Output[],
  metricsMap: Map<string, CandidateOptionMetrics>,
  config: Layer2Config = {}
): Layer2Output[] {
  const cfg = { ...DEFAULT_LAYER2_CONFIG, ...config };

  return layer1Results.map(l1 => {
    const wasApprovedInL1 = l1.passesSqueeze && l1.passesHvPercentile && l1.passesStability && l1.sectorQuotaApproved;

    // Se já veio reprovado das camadas anteriores, propaga com valores neutros
    if (!wasApprovedInL1) {
      return {
        ...l1,
        selectedExpiration: DEFAULT_EMPTY_EXPIRATION,
        atmIv: {
          value: 0,
          provenance: l1.hv12m.provenance,
          source: 'tastytrade-live-atm-iv',
        },
        ivRank: {
          value: 0,
          provenance: l1.hv12m.provenance,
          source: 'tastytrade-tos-ivr-scaled',
        },
        ivPercentile: {
          value: 0,
          provenance: l1.hv12m.provenance,
          source: 'tastytrade-ivp-scaled',
        },
        passesIvFilter: false,
      };
    }

    const metrics = metricsMap.get(l1.symbol);

    // 1. Falha de métricas de mercado (API)
    if (!metrics) {
      return {
        ...l1,
        selectedExpiration: DEFAULT_EMPTY_EXPIRATION,
        atmIv: { value: 0, provenance: 'INDISPONIVEL', source: 'tastytrade-market-metrics' },
        ivRank: { value: 0, provenance: 'INDISPONIVEL', source: 'tastytrade-market-metrics' },
        ivPercentile: { value: 0, provenance: 'INDISPONIVEL', source: 'tastytrade-market-metrics' },
        passesIvFilter: false,
        rejectionCode: 'API_FAILURE',
        rejectionReason: 'Métricas de opções indisponíveis na corretora para este ativo',
      };
    }

    // 2. Seleção de Vencimento Caso B (30 a 45 DTE)
    const selectedExpiration = selectExpirationCasoB(metrics.expirations, {
      minDte: cfg.minDte,
      maxDte: cfg.maxDte,
    });

    if (!selectedExpiration) {
      return {
        ...l1,
        selectedExpiration: DEFAULT_EMPTY_EXPIRATION,
        atmIv: { value: 0, provenance: 'INDISPONIVEL', source: 'tastytrade-market-metrics' },
        ivRank: { value: 0, provenance: 'INDISPONIVEL', source: 'tastytrade-market-metrics' },
        ivPercentile: { value: 0, provenance: 'INDISPONIVEL', source: 'tastytrade-market-metrics' },
        passesIvFilter: false,
        rejectionCode: 'NO_VALID_EXPIRATION_CYCLE',
        rejectionReason: `Nenhum ciclo de vencimento disponível na janela de ${cfg.minDte}-${cfg.maxDte} DTE`,
      };
    }

    // 3. Validação do Histórico de IVR / IVP (Regra de Falha)
    if (
      metrics.rawIvr === null ||
      metrics.rawIvr === undefined ||
      metrics.rawIvp === null ||
      metrics.rawIvp === undefined
    ) {
      return {
        ...l1,
        selectedExpiration,
        atmIv: {
          value: typeof metrics.atmIv === 'number' ? metrics.atmIv : 0,
          provenance: typeof metrics.atmIv === 'number' ? 'MEDIDO' : 'INDISPONIVEL',
          source: 'tastytrade-market-metrics',
        },
        ivRank: { value: 0, provenance: 'INDISPONIVEL', source: 'tastytrade-market-metrics' },
        ivPercentile: { value: 0, provenance: 'INDISPONIVEL', source: 'tastytrade-market-metrics' },
        passesIvFilter: false,
        rejectionCode: 'IV_HISTORY_UNAVAILABLE',
        rejectionReason: 'Histórico de IV insuficiente na corretora para calcular Rank e Percentil',
      };
    }

    // 4. Conversão para Escala 0-100 em PRECISÃO COMPLETA (sem truncamento prévio)
    // Ex: raw 0.3005 vira 30.05 (e NÃO 30.0)
    const ivrScaled = metrics.rawIvr * 100;
    const ivpScaled = metrics.rawIvp * 100;

    const rawAtmIv = metrics.atmIv;
    const isAtmIvValid =
      rawAtmIv !== null &&
      rawAtmIv !== undefined &&
      Number.isFinite(rawAtmIv) &&
      rawAtmIv > 0;

    let atmIvPct = 0;
    if (rawAtmIv !== null && rawAtmIv !== undefined && Number.isFinite(rawAtmIv) && rawAtmIv > 0) {
      atmIvPct = rawAtmIv <= 1.0 ? rawAtmIv * 100 : rawAtmIv;
    }

    const hasSource = Boolean(metrics.source && metrics.source.trim().length > 0);
    const source = hasSource ? metrics.source! : 'fonte-nao-informada';

    // Comparação estrita com precisão completa
    const passesIvr = ivrScaled <= cfg.maxIvRank;
    const passesIvp = ivpScaled <= cfg.maxIvPercentile;
    const passesIvFilter = passesIvr && passesIvp && isAtmIvValid && hasSource;

    let rejectionCode = l1.rejectionCode;
    let rejectionReason = l1.rejectionReason;

    if (!passesIvr || !passesIvp) {
      rejectionCode = 'IV_FILTER_FAIL';
      rejectionReason = `IV Rank (${ivrScaled.toFixed(2)}%) ou IV Percentile (${ivpScaled.toFixed(2)}%) acima do teto de ${cfg.maxIvRank.toFixed(0)}%`;
    } else if (!isAtmIvValid && !rejectionReason) {
      rejectionCode = 'IV_UNAVAILABLE';
      rejectionReason = 'IV ATM não disponível ou inconsistente na corretora (<= 0)';
    } else if (!hasSource && !rejectionReason) {
      rejectionCode = 'IV_UNAVAILABLE';
      rejectionReason = 'Fonte de métricas de IV não informada (rastreabilidade obrigatória pela Regra 00)';
    }

    return {
      ...l1,
      selectedExpiration,
      atmIv: {
        value: Number(atmIvPct.toFixed(2)),
        provenance: (isAtmIvValid && hasSource) ? 'MEDIDO' : 'INDISPONIVEL',
        source,
      },
      ivRank: {
        value: Number(ivrScaled.toFixed(4)), // Precisão completa mantida no valor de domínio
        provenance: hasSource ? 'MEDIDO' : 'INDISPONIVEL',
        source,
      },
      ivPercentile: {
        value: Number(ivpScaled.toFixed(4)), // Precisão completa mantida no valor de domínio
        provenance: hasSource ? 'MEDIDO' : 'INDISPONIVEL',
        source,
      },
      passesIvFilter,
      rejectionCode,
      rejectionReason,
    };
  });
}
