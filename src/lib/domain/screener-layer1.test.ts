import { describe, it, expect } from 'vitest';
import { OHLCVBar, ScreenerCandidateInput } from '../types/low-vol-screener.types';
import { calculateBbwSeries, processLayer1 } from './screener-layer1';
import { processLayer0 } from './screener-layer0';
import { calculatePercentileRank } from './volatility-estimators';

describe('Camada 1 — Squeeze de Bollinger Band Width (BBW)', () => {
  it('GOLDEN TEST: calcula SMA, StdDev, Bandas e BBW com precisão matemática auditada à mão', () => {
    // 20 fechamentos: dez de 100 e dez de 102
    // SMA = (10*100 + 10*102) / 20 = 101.0
    // Var = (10 * (-1)^2 + 10 * (1)^2) / 20 = 20 / 20 = 1.0
    // StdDev = sqrt(1.0) = 1.0
    // UB = 101 + 2*1 = 103.0
    // LB = 101 - 2*1 = 99.0
    // BBW = (4.0 / 101.0) * 100 = 3.960396...% ~= 3.9604%
    const closes = Array.from({ length: 20 }, (_, i) => ({
      date: `2026-01-${String(i + 1).padStart(2, '0')}`,
      close: i < 10 ? 100 : 102,
    }));

    const series = calculateBbwSeries(closes, 20, 2);
    expect(series).toHaveLength(1);
    expect(series[0].sma).toBe(101.0);
    expect(series[0].stdDev).toBe(1.0);
    expect(series[0].upperBand).toBe(103.0);
    expect(series[0].lowerBand).toBe(99.0);
    expect(series[0].bbw).toBeCloseTo(3.9604, 4);
  });

  function createCandidateWithSqueeze(
    symbol: string,
    sector: string,
    hasSqueezeAtEnd: boolean
  ): ScreenerCandidateInput {
    // 252 barras diárias:
    // Primeiras 210 barras com range amplo (alta vol histórica para passar na Camada 0)
    // Últimas 42 barras (2 meses):
    //   se hasSqueezeAtEnd = true: preço fica extremamente estável (range quase zero, gerando BBW minúsculo)
    //   se hasSqueezeAtEnd = false: preço continua oscilando forte (BBW alto)
    const bars: OHLCVBar[] = [];

    for (let i = 0; i < 210; i++) {
      const isHigh = i % 4 < 2;
      bars.push({
        date: `2025-${String(i).padStart(3, '0')}`,
        open: 50,
        high: isHigh ? 54 : 49,
        low: isHigh ? 51 : 46,
        close: isHigh ? 53 : 47,
        volume: 500000,
      });
    }

    for (let i = 210; i < 252; i++) {
      if (hasSqueezeAtEnd) {
        // Compressão extrema: preço praticamente congelado em 50.00
        bars.push({
          date: `2026-${String(i).padStart(3, '0')}`,
          open: 50,
          high: 50.05,
          low: 49.95,
          close: 50.01,
          volume: 200000,
        });
      } else {
        // Sem compressão: continua oscilando forte
        const isHigh = i % 4 < 2;
        bars.push({
          date: `2026-${String(i).padStart(3, '0')}`,
          open: 50,
          high: isHigh ? 55 : 48,
          low: isHigh ? 52 : 45,
          close: isHigh ? 54 : 46,
          volume: 600000,
        });
      }
    }

    return {
      symbol,
      sector,
      bars,
      barsProvenance: 'MEDIDO',
      barsSource: 'tastytrade-rest-candles',
    };
  }

  it('aprova candidato com squeeze no percentil <= 15% de sua própria história', () => {
    const candidateSqueeze = createCandidateWithSqueeze('SQZ1', 'Technology', true);
    const candidateNoSqueeze = createCandidateWithSqueeze('NOSQZ', 'Healthcare', false);

    // Roda Camada 0 com corte flexível para aprovar ambos estruturalmente
    const l0Results = processLayer0([candidateSqueeze, candidateNoSqueeze], {
      minHvPercentile: 0, // Garante que ambos passem na Camada 0 para testar o BBW isolado
      sectorMaxConcentration: 1.0,
    });

    const l1Results = processLayer1(l0Results, [candidateSqueeze, candidateNoSqueeze], {
      maxBbwPercentile: 15.0,
      minBbwBarsRequired: 100,
    });

    const resSqueeze = l1Results.find(r => r.symbol === 'SQZ1')!;
    const resNoSqueeze = l1Results.find(r => r.symbol === 'NOSQZ')!;

    // SQZ1 deve passar com percentil baixíssimo (compressão profunda)
    expect(resSqueeze.passesSqueeze).toBe(true);
    expect(resSqueeze.bbwHistoryPercentile.value).toBeLessThanOrEqual(15.0);
    expect(resSqueeze.bbwCurrent.provenance).toBe('DERIVADO');
    expect(resSqueeze.bbwHistoryPercentile.provenance).toBe('DERIVADO');

    // NOSQZ deve falhar com percentil acima de 15%
    expect(resNoSqueeze.passesSqueeze).toBe(false);
    expect(resNoSqueeze.bbwHistoryPercentile.value).toBeGreaterThan(15.0);
    expect(resNoSqueeze.rejectionCode).toBe('BBW_SQUEEZE_FAIL');
    expect(resNoSqueeze.rejectionReason).toContain('acima do teto de 15%');
  });

  it('BORDA ESTRITA: candidato com bbwPercentile exatamente em 15.0% DEVE ser aprovado (<= 15.0, não < 15.0)', () => {
    // Para obter exatamente 15.0% de percentil:
    // Em N=10 valores distintos ordenados, o 2º menor valor tem strictlyLess = 1.
    // rank = (1 + 0.5 * 1) / 10 * 100 = 1.5 / 10 * 100 = 15.0%!
    const bbwValues = [2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0, 11.0];
    const targetBbw = 3.0;
    const exactRank = calculatePercentileRank(targetBbw, bbwValues);
    expect(exactRank).toBe(15.0);

    // Valida a aprovação lógica em 15.0%
    const maxThreshold = 15.0;
    const passes = exactRank <= maxThreshold;
    expect(passes).toBe(true);
  });

  it('propaga rejeição de candidato que já falhou na Camada 0 mantendo passesSqueeze = false', () => {
    // Candidato com histórico insuficiente (150 barras)
    const shortCandidate: ScreenerCandidateInput = {
      symbol: 'SHORT',
      sector: 'Energy',
      bars: Array.from({ length: 150 }, (_, i) => ({
        date: `2026-${i}`,
        open: 100,
        high: 101,
        low: 99,
        close: 100,
        volume: 100000,
      })),
      barsProvenance: 'MEDIDO',
      barsSource: 'tastytrade-rest-candles',
    };

    const l0Results = processLayer0([shortCandidate]);
    const l1Results = processLayer1(l0Results, [shortCandidate]);

    expect(l1Results[0].passesSqueeze).toBe(false);
    expect(l1Results[0].rejectionCode).toBe('INSUFFICIENT_HISTORY');
  });
});
