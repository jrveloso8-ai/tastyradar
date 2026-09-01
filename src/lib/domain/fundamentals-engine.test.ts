import { describe, it, expect } from 'vitest';
import { fundamentalsEngine } from './fundamentals-engine';
import { RawFundamentalData } from '@/lib/types/financial';

describe('FundamentalsEngine (CNPI-P Audit & Normalization)', () => {
  it('deve aprovar VALE3 com normalização de impairment e reconciliação de dívida financeira líquida', () => {
    // Dados brutos da BRAPI com contaminação contábil (impairment de R$ 25,1 bi e provisões socioambientais no totalDebt)
    const rawVale3: RawFundamentalData = {
      symbol: 'VALE3',
      shortName: 'VALE ON',
      longName: 'Vale S.A.',
      netIncome: 11800000000, // Lucro reduzido por baixa de R$ 25,1 bi
      operatingCashFlow: 50600000000, // FCO forte de R$ 50,6 bi
      totalDebt: 75000000000,
      totalCash: 25000000000,
      ebitda: 16180000000,
      debtToEbitda: 3.09, // Distorcido na fonte bruta
      financialDebt: 37944000000,
      financialDebtToEbitda: 0.8, // Dado oficial 2T26 LTM Proforma
      returnOnEquity: 0.0442, // 4.42% contábil contaminado
      netMargin: 0.0399, // 3.99% contábil
      ebitdaMargin: 0.2381, // 23.81%
      currentRatio: 1.19,
      priceEarnings: 32.29,
      priceToBook: 1.76,
      dividendYield: 0.07,
      nonRecurringImpairment: 25100000000,
    };

    const result = fundamentalsEngine.evaluate(rawVale3);

    expect(result.symbol).toBe('VALE3');
    expect(result.status).toBe('APROVADO');
    expect(result.score).toBeGreaterThanOrEqual(45);
    expect(result.isReconciled).toBe(true);
    expect(result.distortionsDetected.length).toBeGreaterThan(0);

    // Verifica a métrica de Dív. Líq. / EBITDA ajustada para 0.8x
    const debtMetric = result.metrics.find((m) => m.name === 'Dív. Líq. / EBITDA');
    expect(debtMetric).toBeDefined();
    expect(debtMetric?.status).toBe('BOM');
    expect(debtMetric?.value).toBe(0.8);
    expect(debtMetric?.isAdjusted).toBe(true);
    expect(debtMetric?.rawAccountingFormatted).toBe('3.09x');

    // Verifica a métrica de ROE normalizada
    const roeMetric = result.metrics.find((m) => m.name === 'ROE');
    expect(roeMetric).toBeDefined();
    expect(roeMetric?.status).toBe('BOM');
    expect(roeMetric?.value).toBe(16.5);
    expect(roeMetric?.isAdjusted).toBe(true);
    expect(roeMetric?.rawAccountingFormatted).toBe('4.42%');
  });

  it('deve atribuir status N/D (e não NEUTRO) para métricas com valores nulos/indisponíveis', () => {
    const rawEmpty: RawFundamentalData = {
      symbol: 'TICKER_VAZIO',
      netIncome: null,
      operatingCashFlow: null,
      totalDebt: null,
      totalCash: null,
      ebitda: null,
      debtToEbitda: null,
      financialDebt: null,
      financialDebtToEbitda: null,
      returnOnEquity: null,
      netMargin: null,
      ebitdaMargin: null,
      currentRatio: null,
      priceEarnings: null,
      priceToBook: null,
      dividendYield: null,
    };

    const result = fundamentalsEngine.evaluate(rawEmpty);

    expect(result.status).toBe('REPROVADO');
    expect(result.score).toBe(0);

    // Todas as métricas sem dados devem ter status 'N/D' e formatado 'N/D'
    result.metrics.forEach((metric) => {
      expect(metric.status).toBe('N/D');
      expect(metric.formatted).toBe('N/D');
      expect(metric.value).toBeNull();
    });
  });

  it('deve reprovar empresa com fundamentos deteriorados e alta alavancagem', () => {
    const rawDistressed: RawFundamentalData = {
      symbol: 'DISTRESSED',
      netIncome: -500000000,
      operatingCashFlow: -100000000,
      debtToEbitda: 6.5,
      returnOnEquity: -0.15,
      netMargin: -0.08,
      ebitdaMargin: 0.04,
      currentRatio: 0.75,
      priceEarnings: -10,
      priceToBook: 5.5,
      dividendYield: 0.0,
    };

    const result = fundamentalsEngine.evaluate(rawDistressed);

    expect(result.status).toBe('REPROVADO');
    expect(result.score).toBeLessThan(45);
    expect(result.topNegativeDrivers.length).toBeGreaterThan(0);
    expect(result.summary).toContain('REPROVADA');
  });
});
