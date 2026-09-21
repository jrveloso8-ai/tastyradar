/**
 * REGRA 00 — INTEGRIDADE DO DADO EXIBIDO
 * CAMADA 0 — Filtro Estrutural de Volatilidade Histórica (Função Pura, sem I/O)
 *
 * Critérios:
 * 1. Estimador Garman-Klass sobre ~252 barras diárias (anualizado).
 * 2. Critério de Entrada: HV(12m) >= Percentil 65 do universo investível.
 * 3. Filtro de Estabilidade (Winsorização): Exclui os 5% de dias com maior retorno absoluto.
 *    Se o HV recalculado cair mais de 40% (dropRatio > 0.40), descarta o candidato (instabilidade/choque isolado).
 * 4. Teto de Concentração Setorial: Máximo de 25% dos aprovados pertencentes ao mesmo setor GICS,
 *    calculado como ceil(0.25 * N) com mínimo de 1 por setor. Em caso de excesso, mantém os melhores por HV.
 */

import { Layer0Output, ScreenerCandidateInput } from '../types/low-vol-screener.types';
import { calculatePercentileRank, testHvRobustness } from './volatility-estimators';

export interface Layer0Config {
  /**
   * Mínimo de barras diárias exigidas. Default: 250 (~1 ano de pregão).
   * ACOPLAMENTO DE DEPENDÊNCIA: volatility-estimators.ts (testHvRobustness) exige internamente no mínimo 50 barras.
   * Portanto, minBarsRequired NUNCA deve ser configurado abaixo de 50 sem refatoração simultânea em volatility-estimators.ts.
   */
  minBarsRequired?: number; // default 250 barras úteis (~1 ano)
  minHvPercentile?: number; // default 65
  maxHvDropRatio?: number; // default 0.40 (40% de queda máx pós-winsorização)
  sectorMaxConcentration?: number; // default 0.25 (25%)
  maxSpotPrice?: number; // default 100 ($100 teto de preço para adequação de capital/lote)
}

export const DEFAULT_MAX_SPOT_PRICE = 100;

const DEFAULT_CONFIG: Required<Layer0Config> = {
  minBarsRequired: 250,
  minHvPercentile: 65,
  maxHvDropRatio: 0.40,
  sectorMaxConcentration: 0.25,
  maxSpotPrice: DEFAULT_MAX_SPOT_PRICE,
};

/**
 * Executa a filtragem pura da Camada 0 sobre um conjunto de candidatos.
 */
export function processLayer0(
  candidates: ScreenerCandidateInput[],
  config: Layer0Config = {}
): Layer0Output[] {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  // 1. Etapa de cálculo individual por ativo
  interface EvaluatedCandidate {
    candidate: ScreenerCandidateInput;
    spot: number | null;
    passesPriceThreshold: boolean;
    hv12m: number;
    hv12mTrimmed: number;
    dropRatio: number;
    hasValidHistory: boolean;
    passesStability: boolean;
    rejectionCode?: import('../types/low-vol-screener.types').ScreenerRejectionCode;
    rejectionReason?: string;
  }

  const evaluatedList: EvaluatedCandidate[] = [];

  for (const c of candidates) {
    const spot: number | null = typeof c.spotPrice === 'number' && c.spotPrice > 0
      ? c.spotPrice
      : (c.bars && c.bars.length > 0 ? c.bars[c.bars.length - 1].close : null);
    // Spot desconhecido NUNCA aprova o teto de preco (fail-closed).
    const passesPrice = spot !== null && spot > 0 && spot < cfg.maxSpotPrice;

    if (!c.bars || c.bars.length < cfg.minBarsRequired) {
      evaluatedList.push({
        candidate: c,
        spot,
        passesPriceThreshold: passesPrice,
        hv12m: 0,
        hv12mTrimmed: 0,
        dropRatio: 0,
        hasValidHistory: false,
        passesStability: false,
        rejectionCode: 'INSUFFICIENT_HISTORY',
        rejectionReason: `Histórico diário insuficiente (< ${cfg.minBarsRequired} barras disponíveis: ${Array.isArray(c.bars) ? c.bars.length : 'nenhuma'})`,
      });
      continue;
    }

    try {
      const robustness = testHvRobustness(c.bars, cfg.maxHvDropRatio);

      if (!passesPrice) {
        evaluatedList.push({
          candidate: c,
          spot,
          passesPriceThreshold: false,
          hv12m: robustness.originalHv,
          hv12mTrimmed: robustness.trimmedHv,
          dropRatio: robustness.dropRatio,
          hasValidHistory: true,
          passesStability: robustness.isRobust,
          rejectionCode: 'PRICE_ABOVE_THRESHOLD',
          rejectionReason: `Preço spot ($${spot !== null ? spot.toFixed(2) : 'indisponível'}) acima do teto de $${cfg.maxSpotPrice.toFixed(2)} (gestão de capital por lote)`,
        });
        continue;
      }

      evaluatedList.push({
        candidate: c,
        spot,
        passesPriceThreshold: true,
        hv12m: robustness.originalHv,
        hv12mTrimmed: robustness.trimmedHv,
        dropRatio: robustness.dropRatio,
        hasValidHistory: true,
        passesStability: robustness.isRobust,
        rejectionCode: robustness.isRobust ? undefined : 'STABILITY_FAIL',
        rejectionReason: robustness.isRobust ? undefined : `Instabilidade de volatilidade: queda de ${(robustness.dropRatio * 100).toFixed(1)}% pós-winsorização (> ${(cfg.maxHvDropRatio * 100).toFixed(0)}% permitido)`,
      });
    } catch (err: any) {
      const isInvalidData = err.message && (err.message.includes('Barra inválida') || err.message.includes('Barra inconsistente'));
      evaluatedList.push({
        candidate: c,
        spot,
        passesPriceThreshold: passesPrice,
        hv12m: 0,
        hv12mTrimmed: 0,
        dropRatio: 0,
        hasValidHistory: false,
        passesStability: false,
        rejectionCode: isInvalidData ? 'INVALID_BAR_DATA' : 'API_FAILURE',
        rejectionReason: isInvalidData
          ? `Dados de barra corrompidos ou inconsistentes: ${err.message}`
          : `Erro no cálculo de volatilidade: ${err.message}`,
      });
    }
  }

  // 2. Cálculo do percentil de HV(12m) no universo com histórico válido e aprovado no filtro de preço
  const validHvs = evaluatedList.filter(e => e.hasValidHistory && e.passesPriceThreshold).map(e => e.hv12m);

  // 3. Aplica o filtro de percentil e estabilidade
  interface PreQualifiedCandidate extends EvaluatedCandidate {
    hv12mPercentile: number;
    passesHvPercentile: boolean;
  }

  const preQualifiedList: PreQualifiedCandidate[] = evaluatedList.map(item => {
    if (!item.hasValidHistory || !item.passesPriceThreshold) {
      return {
        ...item,
        hv12mPercentile: 0,
        passesHvPercentile: false,
      };
    }

    const percentile = calculatePercentileRank(item.hv12m, validHvs);
    const passesPercentile = percentile >= cfg.minHvPercentile;

    let reason = item.rejectionReason;
    let code = item.rejectionCode;
    if (!passesPercentile && !reason) {
      code = 'HV_PERCENTILE_FAIL';
      reason = `HV(12m) no percentil ${percentile.toFixed(1)}% abaixo do corte de ${cfg.minHvPercentile}%`;
    }

    return {
      ...item,
      hv12mPercentile: percentile,
      passesHvPercentile: passesPercentile,
      rejectionCode: code,
      rejectionReason: reason,
    };
  });

  // Candidatos que passaram no preço, percentil e estabilidade
  const eligibleCandidates = preQualifiedList.filter(
    item => item.hasValidHistory && item.passesPriceThreshold && item.passesHvPercentile && item.passesStability
  );

  // 4. Aplica o teto de concentração setorial: ceil(0.25 * N), mín 1 por setor
  const totalEligible = eligibleCandidates.length;
  const sectorQuota = Math.max(1, Math.ceil(cfg.sectorMaxConcentration * totalEligible));

  // Agrupa os elegíveis por setor
  const bySector = new Map<string, PreQualifiedCandidate[]>();
  for (const item of eligibleCandidates) {
    const list = bySector.get(item.candidate.sector) || [];
    list.push(item);
    bySector.set(item.candidate.sector, list);
  }

  // Identifica quais candidatos são aprovados dentro da cota setorial
  const approvedSymbols = new Set<string>();
  const sectorExceededReasons = new Map<string, string>();

  for (const [sector, items] of bySector.entries()) {
    // Ordena pelo percentil de HV decrescente (ou HV absoluto)
    const sorted = [...items].sort((a, b) => b.hv12m - a.hv12m);
    for (let i = 0; i < sorted.length; i++) {
      if (i < sectorQuota) {
        approvedSymbols.add(sorted[i].candidate.symbol);
      } else {
        sectorExceededReasons.set(
          sorted[i].candidate.symbol,
          `Excedeu teto setorial de ${sectorQuota} ativo(s) para o setor '${sector}'`
        );
      }
    }
  }

  // 5. Monta o Layer0Output final com proveniência e contratos estritos
  return preQualifiedList.map(item => {
    const isAvailable = item.hasValidHistory;
    const isApproved = approvedSymbols.has(item.candidate.symbol);

    let finalRejectionReason = item.rejectionReason;
    let finalRejectionCode = item.rejectionCode;
    if (!finalRejectionReason && !isApproved && sectorExceededReasons.has(item.candidate.symbol)) {
      finalRejectionCode = 'SECTOR_QUOTA_FAIL';
      finalRejectionReason = sectorExceededReasons.get(item.candidate.symbol);
    }

    const source = 'garman-klass-annualized-252';

    return {
      symbol: item.candidate.symbol,
      sector: item.candidate.sector,
      spotPrice: item.spot !== null && item.spot > 0
        ? {
            value: item.spot,
            provenance: typeof item.candidate.spotPrice === 'number' ? 'MEDIDO' : item.candidate.barsProvenance,
            source: typeof item.candidate.spotPrice === 'number'
              ? 'live-spot-quote'
              : `ultimo-fechamento-diario (${item.candidate.barsSource})`,
          }
        : { value: 0, provenance: 'INDISPONIVEL', source: item.candidate.barsSource },
      passesPriceThreshold: item.passesPriceThreshold,
      hv12m: {
        value: item.hv12m,
        provenance: isAvailable ? 'DERIVADO' : 'INDISPONIVEL',
        source,
      },
      hv12mTrimmed: {
        value: item.hv12mTrimmed,
        provenance: isAvailable ? 'DERIVADO' : 'INDISPONIVEL',
        source: 'garman-klass-trimmed-5pct',
      },
      hvDropRatio: {
        value: item.dropRatio,
        provenance: isAvailable ? 'DERIVADO' : 'INDISPONIVEL',
        source: 'trimmed-drop-ratio',
      },
      hv12mPercentile: {
        value: item.hv12mPercentile,
        provenance: isAvailable ? 'DERIVADO' : 'INDISPONIVEL',
        source: 'universe-percentile-rank',
      },
      passesHvPercentile: item.passesHvPercentile,
      passesStability: item.passesStability,
      sectorQuotaApproved: isApproved,
      rejectionCode: finalRejectionCode,
      rejectionReason: finalRejectionReason,
    };
  });
}
