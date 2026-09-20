import { describe, it, expect } from 'vitest';
import { normalizeSector, GicsSector } from './sector-normalizer';
import { CURATED_80_UNIVERSE } from '../../../scripts/run-shadow-screener';

describe('Sector Normalizer (GICS + ETF)', () => {
  const allowedSectors: Set<GicsSector> = new Set([
    'Information Technology',
    'Health Care',
    'Financials',
    'Consumer Discretionary',
    'Consumer Staples',
    'Communication Services',
    'Industrials',
    'Energy',
    'Utilities',
    'Materials',
    'Real Estate',
    'ETF',
  ]);

  it('normaliza todos os 80 tickers do CURATED_80_UNIVERSE para a taxonomia oficial', () => {
    expect(CURATED_80_UNIVERSE.length).toBe(80);

    for (const item of CURATED_80_UNIVERSE) {
      const normalized = normalizeSector(item.symbol, item.sector);
      expect(allowedSectors.has(normalized)).toBe(true);
      expect(item.sector).toBe(normalized); // O universo já deve conter o setor normalizado
    }
  });

  it('classifica os ETFs QQQ, SPY e IWM estritamente no agrupamento "ETF"', () => {
    expect(normalizeSector('SPY')).toBe('ETF');
    expect(normalizeSector('QQQ')).toBe('ETF');
    expect(normalizeSector('IWM')).toBe('ETF');
  });

  it('unifica sub-indústrias de semicondutores e software em "Information Technology"', () => {
    expect(normalizeSector('NVDA', 'Semiconductors')).toBe('Information Technology');
    expect(normalizeSector('AMD', 'Semiconductors')).toBe('Information Technology');
    expect(normalizeSector('PLTR', 'Software')).toBe('Information Technology');
    expect(normalizeSector('CRM', 'Tecnologia')).toBe('Information Technology');
  });

  it('elimina divergências de idioma entre Saúde e Health Care', () => {
    expect(normalizeSector('ABBV', 'Saúde')).toBe('Health Care');
    expect(normalizeSector('JNJ', 'Saúde')).toBe('Health Care');
    expect(normalizeSector('PFE', 'Healthcare')).toBe('Health Care');
  });

  it('elimina divergências de idioma entre Financeiro e Financials', () => {
    expect(normalizeSector('GS', 'Financeiro')).toBe('Financials');
    expect(normalizeSector('JPM', 'Financials')).toBe('Financials');
  });
});
