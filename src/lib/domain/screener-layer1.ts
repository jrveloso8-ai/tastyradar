/**
 * REGRA 00 — INTEGRIDADE DO DADO EXIBIDO
 * CAMADA 1 — Squeeze de Bollinger Band Width (Função Pura, sem I/O)
 *
 * Critérios:
 * 1. BBW(20, 2 desvios) calculado sobre a série diária de fechamentos.
 *    SMA(20) = média dos últimos 20 fechamentos
 *    StdDev(20) = desvio padrão populacional dos últimos 20 fechamentos
 *    UB = SMA + 2 * StdDev
 *    LB = SMA - 2 * StdDev
 *    BBW = ((UB - LB) / SMA) * 100 = (4 * StdDev / SMA) * 100
 *
 * 2. Série de BBW calculada para todas as barras da série histórica do ativo (mín 6 a 12 meses).
 * 3. Percentil empírico do BBW atual relativo à sua própria série histórica (compressão própria, não inter-ativos).
 * 4. Critério de Aprovação: BBW Percentile <= 15.0% (avaliado em precisão completa, sem truncamento prévio).
 */

import { Layer0Output, Layer1Output, ScreenerCandidateInput } from '../types/low-vol-screener.types';
import { calculatePercentileRank } from './volatility-estimators';

export interface Layer1Config {
  period?: number; // default 20
  numStdDev?: number; // default 2
  maxBbwPercentile?: number; // default 15.0
  minBbwBarsRequired?: number; // default 126 (mínimo ~6 meses de histórico para percentil próprio)
}

const DEFAULT_LAYER1_CONFIG: Required<Layer1Config> = {
  period: 20,
  numStdDev: 2,
  maxBbwPercentile: 15.0,
  minBbwBarsRequired: 126,
};

export interface BbwBarCalculation {
  date: string;
  sma: number;
  stdDev: number;
  upperBand: number;
  lowerBand: number;
  bbw: number; // em %
}

/**
 * Calcula a série histórica completa de Bollinger Bands e BBW para um conjunto de preços de fechamento.
 */
export function calculateBbwSeries(
  closes: { date: string; close: number }[],
  period = 20,
  numStdDev = 2
): BbwBarCalculation[] {
  if (!closes || closes.length < period) {
    return [];
  }

  const result: BbwBarCalculation[] = [];

  for (let i = period - 1; i < closes.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += closes[i - j].close;
    }
    const sma = sum / period;

    let sumSqDiff = 0;
    for (let j = 0; j < period; j++) {
      const diff = closes[i - j].close - sma;
      sumSqDiff += diff * diff;
    }
    // Desvio padrão clássico de John Bollinger (populacional N=period)
    const stdDev = Math.sqrt(sumSqDiff / period);
    const upperBand = sma + numStdDev * stdDev;
    const lowerBand = sma - numStdDev * stdDev;
    const bbw = sma > 0 ? ((upperBand - lowerBand) / sma) * 100 : 0;

    result.push({
      date: closes[i].date,
      sma: Number(sma.toFixed(4)),
      stdDev: Number(stdDev.toFixed(4)),
      upperBand: Number(upperBand.toFixed(4)),
      lowerBand: Number(lowerBand.toFixed(4)),
      bbw: Number(bbw.toFixed(4)),
    });
  }

  return result;
}

/**
 * Executa a filtragem pura da Camada 1 sobre os candidatos aprovados na Camada 0.
 */
export function processLayer1(
  layer0Results: Layer0Output[],
  candidateInputs: ScreenerCandidateInput[],
  config: Layer1Config = {}
): Layer1Output[] {
  const cfg = { ...DEFAULT_LAYER1_CONFIG, ...config };

  const inputMap = new Map<string, ScreenerCandidateInput>();
  for (const c of candidateInputs) {
    inputMap.set(c.symbol, c);
  }

  return layer0Results.map(l0 => {
    const candidate = inputMap.get(l0.symbol);
    const wasApprovedInL0 = l0.passesHvPercentile && l0.passesStability && l0.sectorQuotaApproved;

    // Se o candidato já foi rejeitado na Camada 0, propaga com BBW neutro.
    // Nota defensiva: a checagem (!candidate.bars || candidate.bars.length < cfg.period) é uma guarda
    // contra estado impossível em tempo de execução, dado que a Camada 0 já exige no mínimo 250 barras para aprovação.
    if (!wasApprovedInL0 || !candidate || !candidate.bars || candidate.bars.length < cfg.period) {
      return {
        ...l0,
        bbwCurrent: {
          value: 0,
          provenance: wasApprovedInL0 ? 'INDISPONIVEL' : l0.hv12m.provenance,
          source: 'bollinger-bands-width-20-2',
        },
        bbwHistoryPercentile: {
          value: 100,
          provenance: wasApprovedInL0 ? 'INDISPONIVEL' : l0.hv12m.provenance,
          source: 'bbw-self-history-percentile',
        },
        passesSqueeze: false,
      };
    }

    // Calcula a série de BBW
    const closes = candidate.bars.map(b => ({ date: b.date, close: b.close }));
    const bbwSeries = calculateBbwSeries(closes, cfg.period, cfg.numStdDev);

    if (bbwSeries.length < cfg.minBbwBarsRequired) {
      return {
        ...l0,
        bbwCurrent: {
          value: 0,
          provenance: 'INDISPONIVEL',
          source: 'bollinger-bands-width-20-2',
        },
        bbwHistoryPercentile: {
          value: 100,
          provenance: 'INDISPONIVEL',
          source: 'bbw-self-history-percentile',
        },
        passesSqueeze: false,
        rejectionCode: 'INSUFFICIENT_HISTORY',
        rejectionReason: `Histórico insuficiente para compressão BBW (< ${cfg.minBbwBarsRequired} barras após warmup: ${bbwSeries.length})`,
      };
    }

    const currentBbw = bbwSeries[bbwSeries.length - 1].bbw;
    const allBbwValues = bbwSeries.map(b => b.bbw);
    const bbwPercentile = calculatePercentileRank(currentBbw, allBbwValues);

    // Comparação em precisão completa, sem truncamento prévio (Ponto 3)
    const passesSqueeze = bbwPercentile <= cfg.maxBbwPercentile;

    let rejectionCode = l0.rejectionCode;
    let rejectionReason = l0.rejectionReason;

    if (!passesSqueeze && !rejectionReason) {
      rejectionCode = 'BBW_SQUEEZE_FAIL';
      rejectionReason = `BBW atual (${currentBbw.toFixed(2)}%) no percentil ${bbwPercentile.toFixed(1)}% acima do teto de ${cfg.maxBbwPercentile.toFixed(0)}%`;
    }

    return {
      ...l0,
      bbwCurrent: {
        value: currentBbw,
        provenance: 'DERIVADO',
        source: 'bollinger-bands-width-20-2',
      },
      bbwHistoryPercentile: {
        value: bbwPercentile,
        provenance: 'DERIVADO',
        source: 'bbw-self-history-percentile',
      },
      passesSqueeze,
      rejectionCode,
      rejectionReason,
    };
  });
}
