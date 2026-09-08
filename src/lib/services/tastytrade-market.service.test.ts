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

  it('should compute GEX analysis with valid strikes and provenance', async () => {
    const gex = await tastyMarketService.getGexAnalysis('SPY');
    expect(gex).toBeDefined();
    expect(gex.symbol).toBe('SPY');
    expect(gex.spotPrice).toBeGreaterThan(0);
    expect(gex.strikes.length).toBeGreaterThan(0);
    expect(gex.source).toMatch(/tastytrade-live|calibrated-model/);
  });
});
