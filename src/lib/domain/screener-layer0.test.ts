import { describe, it, expect } from 'vitest';
import { OHLCVBar, ScreenerCandidateInput } from '../types/low-vol-screener.types';
import {
  calculateGarmanKlassBarVariance,
  calculateGarmanKlassHV,
  calculatePercentileRank,
  testHvRobustness,
} from './volatility-estimators';
import { processLayer0 } from './screener-layer0';

describe('Estimadores de Volatilidade — Garman-Klass e Robustez', () => {
  it('GOLDEN TEST: calcula a variância de barra Garman-Klass exatamente conforme fórmula matemática manual', () => {
    // Conta manual fora do código:
    // O=100, H=105, L=95, C=102
    // ln(105/95) = 0.100083459
    // 0.5 * (0.100083459)^2 = 0.005008350
    // ln(102/100) = 0.019802627
    // (2*ln(2) - 1) * (0.019802627)^2 = 0.386294361 * 0.000392144 = 0.000151483
    // variância esperada = 0.005008350 - 0.000151483 = 0.004856867
    const bar: OHLCVBar = {
      date: '2026-01-02',
      open: 100,
      high: 105,
      low: 95,
      close: 102,
      volume: 1000000,
    };

    const variance = calculateGarmanKlassBarVariance(bar);
    expect(variance).toBeCloseTo(0.004856867, 7);
  });

  it('GOLDEN TEST: anualiza Garman-Klass para série de 252 barras idênticas', () => {
    // Variância diária = 0.004856867
    // sqrt(0.004856867 * 252) * 100 = sqrt(1.2239304) * 100 = 110.6314%
    const bars: OHLCVBar[] = Array.from({ length: 252 }, (_, i) => ({
      date: `2026-01-${String(i + 1).padStart(3, '0')}`,
      open: 100,
      high: 105,
      low: 95,
      close: 102,
      volume: 500000,
    }));

    const result = calculateGarmanKlassHV(bars);
    expect(result.annualizedHv).toBeCloseTo(110.6314, 2);
    expect(result.validBarsCount).toBe(252);
  });

  it('calcula o percentil empírico corretamente com e sem empates', () => {
    const values = [10, 20, 30, 40, 50];
    expect(calculatePercentileRank(10, values)).toBe(10); // (0 + 0.5) / 5 * 100
    expect(calculatePercentileRank(30, values)).toBe(50); // (2 + 0.5) / 5 * 100
    expect(calculatePercentileRank(50, values)).toBe(90); // (4 + 0.5) / 5 * 100
    expect(calculatePercentileRank(5, values)).toBe(0);
    expect(calculatePercentileRank(60, values)).toBe(100);
  });

  it('detecta instabilidade quando 5% dos dias concentram choques anormais (winsorização com queda > 40%)', () => {
    // Cria 240 barras normais de baixíssima volatilidade (range diário de 0.2%, H=100.1, L=99.9, C=100)
    const normalBars: OHLCVBar[] = Array.from({ length: 240 }, (_, i) => ({
      date: `2025-bar-${i}`,
      open: 100,
      high: 100.1,
      low: 99.9,
      close: 100,
      volume: 100000,
    }));

    // Insere 12 barras com picos/choques extremos de retorno (ex: alternando +15% e -15% a cada dia)
    const shockBars: OHLCVBar[] = Array.from({ length: 12 }, (_, i) => {
      const isUp = i % 2 === 0;
      return {
        date: `2026-shock-${i}`,
        open: isUp ? 100 : 120,
        high: isUp ? 122 : 122,
        low: isUp ? 98 : 98,
        close: isUp ? 120 : 100, // Salto de 20% no fechamento
        volume: 1000000,
      };
    });

    const mixedBars = [...normalBars, ...shockBars];

    const robustness = testHvRobustness(mixedBars, 0.40);
    expect(robustness.excludedBarsCount).toBe(Math.ceil(0.05 * 252)); // 13 barras
    // A série original tem volatilidade muito maior que a série aparada
    expect(robustness.originalHv).toBeGreaterThan(robustness.trimmedHv);
    // A queda deve exceder 40% (dropRatio > 0.40)
    expect(robustness.dropRatio).toBeGreaterThan(0.40);
    expect(robustness.isRobust).toBe(false);
  });
});

describe('Camada 0 — Filtro Estrutural e Teto Setorial', () => {
  function generateSyntheticCandidate(
    symbol: string,
    sector: string,
    barsCount: number,
    volMultiplier = 1.0,
    basePrice = 50
  ): ScreenerCandidateInput {
    const bars: OHLCVBar[] = Array.from({ length: barsCount }, (_, i) => {
      const spread = 0.5 * volMultiplier;
      return {
        date: `2026-d-${i}`,
        open: basePrice,
        high: basePrice + spread,
        low: basePrice - spread,
        close: basePrice + (spread * 0.2),
        volume: 200000,
      };
    });

    return {
      symbol,
      sector,
      bars,
      barsProvenance: 'MEDIDO',
      barsSource: 'tastytrade-rest-candles',
    };
  }

  it('rejeita candidato com spot >= $100 com rejectionCode PRICE_ABOVE_THRESHOLD', () => {
    // Candidato com spot = $105.00 (> $100)
    const expensiveCandidate = generateSyntheticCandidate('EXPENSIVE', 'Technology', 252, 1.0, 105);
    const results = processLayer0([expensiveCandidate]);

    expect(results).toHaveLength(1);
    expect(results[0].passesPriceThreshold).toBe(false);
    expect(results[0].rejectionCode).toBe('PRICE_ABOVE_THRESHOLD');
    expect(results[0].rejectionReason).toContain('Preço spot');
    expect(results[0].rejectionReason).toContain('acima do teto de $100.00');
  });

  it('rejeita candidato com histórico insuficiente (< 250 barras) marcando INDISPONIVEL', () => {
    const candidates = [generateSyntheticCandidate('AAPL', 'Technology', 150)];
    const result = processLayer0(candidates);

    expect(result).toHaveLength(1);
    expect(result[0].passesHvPercentile).toBe(false);
    expect(result[0].passesStability).toBe(false);
    expect(result[0].hv12m.provenance).toBe('INDISPONIVEL');
    expect(result[0].rejectionReason).toContain('Histórico diário insuficiente');
  });

  it('aplica o corte de percentil >= 65 e teto setorial ceil(0.25 * N)', () => {
    // Monta universo de 10 candidatos com volatilidades ordenadas e graduadas:
    // TECH1 a TECH6 (alta vol: 4.0 a 3.5), HLTH1 (3.4), FIN1 (3.3), LOW1 (1.0), LOW2 (0.8)
    const candidates: ScreenerCandidateInput[] = [
      generateSyntheticCandidate('TECH1', 'Technology', 252, 4.0),
      generateSyntheticCandidate('TECH2', 'Technology', 252, 3.9),
      generateSyntheticCandidate('TECH3', 'Technology', 252, 3.8),
      generateSyntheticCandidate('TECH4', 'Technology', 252, 3.7),
      generateSyntheticCandidate('TECH5', 'Technology', 252, 3.6),
      generateSyntheticCandidate('TECH6', 'Technology', 252, 3.5),
      generateSyntheticCandidate('HLTH1', 'Healthcare', 252, 3.4),
      generateSyntheticCandidate('FIN1', 'Financials', 252, 3.3),
      generateSyntheticCandidate('LOW1', 'Energy', 252, 1.0),
      generateSyntheticCandidate('LOW2', 'Utilities', 252, 0.8),
    ];

    const results = processLayer0(candidates, { minHvPercentile: 65, sectorMaxConcentration: 0.25 });

    // Candidatos de baixa vol (LOW1 e LOW2) devem falhar no percentil 65
    const low1 = results.find(r => r.symbol === 'LOW1')!;
    expect(low1.passesHvPercentile).toBe(false);

    // Candidatos elegíveis (passesHvPercentile && passesStability)
    const eligible = results.filter(r => r.passesHvPercentile && r.passesStability);
    // Em N=10 com percentil >= 65, passam os índices com percentil >= 65 (TECH1..TECH4 têm 95%, 85%, 75% e 65%)
    expect(eligible).toHaveLength(4);

    // Teto setorial: com 4 elegíveis, ceil(0.25 * 4) = 1 ativo permitido para Technology
    const maxAllowedTech = Math.max(1, Math.ceil(0.25 * eligible.length));
    expect(maxAllowedTech).toBe(1);

    // Aprovados finais da Camada 0 com cota setorial
    const approvedInLayer0 = results.filter(r => r.sectorQuotaApproved);
    const approvedTech = approvedInLayer0.filter(r => r.sector === 'Technology');
    expect(approvedTech).toHaveLength(1);
    expect(approvedTech[0].symbol).toBe('TECH1'); // O de maior HV foi o selecionado

    // Os excedentes de Technology que passaram no percentil 65 mas estouraram a cota (TECH2, TECH3, TECH4)
    const rejectedTechQuota = results.filter(
      r => r.sector === 'Technology' && r.passesHvPercentile && r.passesStability && !r.sectorQuotaApproved
    );
    expect(rejectedTechQuota).toHaveLength(3);
    expect(rejectedTechQuota.map(r => r.symbol)).toEqual(['TECH2', 'TECH3', 'TECH4']);
    for (const r of rejectedTechQuota) {
      expect(r.rejectionReason).toContain('Excedeu teto setorial');
    }

    // TECH5 e TECH6 foram rejeitados no percentil < 65% (55% e 45%)
    const rejectedTechPercentile = results.filter(
      r => r.sector === 'Technology' && !r.passesHvPercentile
    );
    expect(rejectedTechPercentile).toHaveLength(2);
    for (const r of rejectedTechPercentile) {
      expect(r.rejectionReason).toContain('abaixo do corte de 65%');
    }
  });

  it('rejeita candidato com barras malformadas (preço <= 0 ou High < Low) com rejectionCode INVALID_BAR_DATA', () => {
    const corruptCandidate: ScreenerCandidateInput = {
      symbol: 'BAD_DATA',
      sector: 'Technology',
      bars: Array.from({ length: 252 }, (_, i) => ({
        date: `2026-01-${String(i + 1).padStart(3, '0')}`,
        open: 50,
        high: i === 10 ? 40 : 55, // Barra 10 tem High (40) < Low (45) -> inconsistência de feed
        low: 45,
        close: 52,
        volume: 500000,
      })),
      barsProvenance: 'MEDIDO',
      barsSource: 'tastytrade-rest-candles',
    };

    const results = processLayer0([corruptCandidate]);
    expect(results).toHaveLength(1);
    expect(results[0].passesHvPercentile).toBe(false);
    expect(results[0].passesStability).toBe(false);
    expect(results[0].rejectionCode).toBe('INVALID_BAR_DATA');
    expect(results[0].rejectionReason).toContain('Dados de barra corrompidos ou inconsistentes');
    expect(results[0].rejectionReason).toContain('High < Low');
  });
});

