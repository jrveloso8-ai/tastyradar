import { describe, it, expect } from 'vitest';
import { tastyMarketService } from './tastytrade-market.service';

describe('TastytradeMarketService - Market Metrics', () => {
  it('should retrieve metrics and handle fallback when offline or cached', async () => {
    const metrics = await tastyMarketService.getMarketMetrics(['SPY', 'F']);
    expect(metrics).toBeDefined();
    expect(metrics.SPY).toBeDefined();
    expect(metrics.F).toBeDefined();
    expect(metrics.SPY.symbol).toBe('SPY');
    expect(metrics.F.symbol).toBe('F');

    // Assegura valores plausíveis de volatilidade
    expect(metrics.SPY.ivRank).toBeGreaterThanOrEqual(0);
    expect(metrics.SPY.iv30).toBeGreaterThan(0);
    expect(metrics.F.ivRank).toBeGreaterThanOrEqual(0);
    expect(metrics.F.iv30).toBeGreaterThan(0);
  });

  it('should return empty object if no symbols provided', async () => {
    const metrics = await tastyMarketService.getMarketMetrics([]);
    expect(metrics).toEqual({});
  });

  // getQuote()/getGexAnalysis() foram removidos do serviço (Nível 1, Parte 1 — eram
  // código morto com uma terceira fonte de spot divergente). O teste de GEX que existia
  // aqui cobria esse método removido; a cobertura de calculateGex() em si permanece em
  // gex-engine.test.ts, que é o motor de verdade e não mudou.
});
