import { describe, it, expect } from 'vitest';
import { SP500_DATASET, getTop50LiquidUnder150, searchSP500, getSP500Asset } from './sp500-dataset';

describe('S&P 500 Dataset & Liquidity Filtering', () => {
  it('deve filtrar estritamente ativos com cotação spot <= $150 no Top 50', () => {
    const under150 = getTop50LiquidUnder150();

    expect(under150.length).toBeGreaterThan(0);
    expect(under150.length).toBeLessThanOrEqual(50);

    for (const stock of under150) {
      expect(stock.spot).toBeLessThanOrEqual(150.00);
      expect(stock.liquidityRating).toBeGreaterThanOrEqual(3);
    }
  });

  it('deve conter os principais ativos de alta liquidez acessíveis (NVDA, AMD, PLTR, BAC, KO, F, SOFI)', () => {
    const symbols = getTop50LiquidUnder150().map(s => s.symbol);

    expect(symbols).toContain('NVDA');
    expect(symbols).toContain('AMD');
    expect(symbols).toContain('PLTR');
    expect(symbols).toContain('BAC');
    expect(symbols).toContain('KO');
    expect(symbols).toContain('F');
    expect(symbols).toContain('SOFI');
  });

  it('não deve incluir ativos caros (> $150) no Top 50 de margem controlada', () => {
    const symbols = getTop50LiquidUnder150().map(s => s.symbol);

    expect(symbols).not.toContain('SPY');
    expect(symbols).not.toContain('META');
    expect(symbols).not.toContain('MSFT');
    expect(symbols).not.toContain('LLY');
  });

  it('deve permitir a busca global de qualquer ativo do S&P 500 (mesmo > $150)', () => {
    const searchMeta = searchSP500('META');
    expect(searchMeta.some(s => s.symbol === 'META')).toBe(true);

    const searchTech = searchSP500('Tech');
    expect(searchTech.length).toBeGreaterThan(0);

    const searchApple = searchSP500('Apple');
    expect(searchApple.some(s => s.symbol === 'AAPL')).toBe(true);
  });

  it('deve retornar ou criar fallback determinístico para ativos buscados', () => {
    const nvda = getSP500Asset('NVDA');
    expect(nvda.symbol).toBe('NVDA');
    expect(nvda.spot).toBe(142.50);

    const custom = getSP500Asset('GE');
    expect(custom.symbol).toBe('GE');
    expect(custom.spot).toBeGreaterThan(0);
    expect(custom.putWall).toBeLessThan(custom.spot);
    expect(custom.callWall).toBeGreaterThan(custom.spot);
  });
});
