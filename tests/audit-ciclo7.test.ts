import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { rankTopByOpenInterest } from '../src/lib/domain/top-oi-ranking';
import { aiConsultantEngine } from '../src/lib/domain/ai-consultant';
import { classifyRegime, planStrategy, buildRecommendation, VolatilityAssetInput } from '../src/lib/domain/volatility-engine';
import { calculateGex } from '../src/lib/domain/gex-engine';
import { OptionChainResult, OptionChainStrike, OptionChainExpiration } from '../src/lib/services/tastytrade-market.service';
import { RealGreeksQuote } from '../src/lib/services/tastytrade-dxlink.service';

vi.mock('../src/lib/services/tastytrade-auth.service', () => ({
  tastyAuthService: { getAccessToken: vi.fn().mockResolvedValue('fake-token-for-tests') },
}));
import { tastyMarketService } from '../src/lib/services/tastytrade-market.service';

const read = (rel: string) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

describe('Ciclo 7 — F1: Top 10 OI usa Open Interest REAL, nunca derivado da distância ao spot', () => {
  const strikes = [90, 95, 100, 105, 110].map((k) => ({
    strike: k,
    callSymbol: `C${k}`,
    putSymbol: `P${k}`,
    callStreamerSymbol: `.C${k}`,
    putStreamerSymbol: `.P${k}`,
  }));

  it('ranqueia pelo OI real medido (não pela proximidade do spot) e exclui strike sem OI', () => {
    const oi = new Map<string, number | null>([
      ['.C90', 9000], // longe do spot, mas com OI real maior
      ['.C100', 500],
      ['.C105', null], // sem OI real => fora do ranking
      ['.P95', 300],
      ['.P100', 700],
    ]);
    const r = rankTopByOpenInterest(strikes, oi, 100, 10);
    expect(r.calls.map((c) => c.strike)).toEqual([90, 100]);
    expect(r.calls[0].openInterest).toBe(9000);
    expect(r.puts.map((p) => p.strike)).toEqual([100, 95]);
    expect(r.calls.find((c) => c.strike === 105)).toBeUndefined();
    expect(r.totalCallOI).toBe(9500);
    expect(r.totalPutOI).toBe(1000);
  });

  it('razão put/call é null (não 1.0) quando não há OI de call medido', () => {
    const oi = new Map<string, number | null>([['.P100', 700]]);
    const r = rankTopByOpenInterest(strikes, oi, 100, 10);
    expect(r.pcRatioOI).toBeNull();
  });

  it('a rota não contém mais a fórmula que inventava OI (weight * 15 / weight * 12)', () => {
    const code = read('src/app/api/options/top10-oi/route.ts');
    expect(code).not.toMatch(/weight\s*\*\s*\d+/);
    expect(code).not.toMatch(/openInterest:\s*weight/);
  });
});

describe('Ciclo 7 — F2: consultor de IA não fabrica stop/alvo/IV Rank para ticker fora da cobertura', () => {
  it('ticker desconhecido => recusa, sem números inventados', async () => {
    const r = await aiConsultantEngine.consult('qual o stop?', { symbol: 'ZZZQ' });
    expect(r.answer).toContain('fora da cobertura');
    expect(r.answer).not.toMatch(/142\.50|157\.50|165\.00|2\.10:1/);
    expect(r.contextUsed.gexRegime).toBe('INDISPONIVEL');
    expect(r.contextUsed.electedStrategy).toBe('INDISPONIVEL');
  });

  it('ticker coberto continua sendo respondido', async () => {
    const r = await aiConsultantEngine.consult('qual o stop?', { symbol: 'AAPL' });
    expect(r.answer).not.toContain('fora da cobertura');
  });
});

const baseInput: VolatilityAssetInput = {
  symbol: 'NVDA',
  name: 'NVIDIA Corp',
  spot: 142.5,
  change: 2.84,
  iv30: 44.5,
  rv20: 32.1,
  ivr: 74.2,
  ivp: 81.0,
  netGex: 120.5,
  zeroGammaFlip: 138.0,
  putWall: 135.0,
  callWall: 155.0,
};

function mockChain(spot: number, dte: number): OptionChainResult {
  const center = Math.round(spot / 5) * 5;
  const strikes: OptionChainStrike[] = [];
  for (let i = -10; i <= 10; i++) {
    const strike = center + i * 5;
    strikes.push({
      strike,
      callSymbol: `NVDA  260101C${String(strike * 1000).padStart(8, '0')}`,
      putSymbol: `NVDA  260101P${String(strike * 1000).padStart(8, '0')}`,
      callStreamerSymbol: `.NVDA260101C${strike}`,
      putStreamerSymbol: `.NVDA260101P${strike}`,
    });
  }
  const exp: OptionChainExpiration = {
    expirationDate: '2026-01-01',
    daysToExpiration: dte,
    expirationType: 'Regular',
    settlementType: 'PM',
    strikes,
  };
  return { symbol: 'NVDA', expirations: [exp, { ...exp, expirationDate: '2026-02-01', daysToExpiration: dte + 30 }], source: 'tastytrade-live', fetchedAt: new Date().toISOString() };
}

describe('Ciclo 7 — F4: motor de volatilidade não decide com dado ausente assumido como 0', () => {
  it('VRP: sem IV30/RV20 => vrp null e regime NEUTRAL (antes: 0 + IVR baixo => BUY_VOLATILITY)', () => {
    const input = { ...baseInput, iv30: undefined, rv20: undefined, ivr: 10, netGex: 50 } as unknown as VolatilityAssetInput;
    const r = classifyRegime(input);
    expect(r.vrp).toBeNull();
    expect(r.volRegime).toBe('NEUTRAL');
  });

  function recFor(over: Partial<VolatilityAssetInput>) {
    const input = { ...baseInput, ...over } as VolatilityAssetInput;
    const plan = planStrategy(input, mockChain(input.spot, 35))!;
    const quotes = new Map<string, { bid: number | null; ask: number | null; mid: number | null }>();
    const greeks = new Map<string, RealGreeksQuote>();
    for (const leg of plan.legs) {
      quotes.set(leg.occSymbol, { bid: 1.45, ask: 1.55, mid: 1.5 });
      greeks.set(leg.streamerSymbol, { symbol: leg.streamerSymbol, delta: leg.action === 'SELL' ? -0.2 : 0.2, gamma: 0.01, iv: 0.35, openInterest: 500, lastPrice: null });
    }
    return buildRecommendation(input, plan, quotes, greeks)!;
  }

  it('dividendo ausente => teste INDISPONIVEL (hasDividendRisk null), não "Seguro: $0.00"', () => {
    const rec = recFor({});
    expect(rec.lifecycle.hasDividendRisk).toBeNull();
    expect(rec.lifecycle.dividendRiskReason).not.toContain('Seguro');
    expect(rec.lifecycle.dividendRiskReason).toContain('indisponivel');
  });

  it('extrínseco vem da cotação REAL da call vendida; o callExtrinsic estático do catálogo é ignorado', () => {
    // Estático diria: dividendo 0.50 > extrinseco 0.10 => risco. Real (mid 1.50, call OTM): 0.50 < 1.50 => sem risco.
    const rec = recFor({ dividendAmount: 0.5, callExtrinsic: 0.1 });
    expect(rec.lifecycle.hasDividendRisk).toBe(false);
    expect(rec.lifecycle.dividendRiskReason).toContain('1.50');
  });

  it('dividendo maior que o extrínseco real dispara o alerta de atribuição', () => {
    const rec = recFor({ dividendAmount: 5 });
    expect(rec.lifecycle.hasDividendRisk).toBe(true);
    expect(rec.lifecycle.dividendRiskReason).toContain('ALERTA DE ATRIBUIÇÃO');
  });

  it('o motor não lê mais callExtrinsic estático nem assume extrínseco de 50% do crédito', () => {
    const code = read('src/lib/domain/volatility-engine.ts');
    expect(code).not.toContain('input.callExtrinsic');
    expect(code).not.toMatch(/netCredit\s*\*\s*0\.5/);
  });
});

describe('Ciclo 7 — F5: GEX não fabrica razão put/call nem distância de paredes', () => {
  it('sem opções => razão put/call e distância entre paredes são null (não 0)', () => {
    const r = calculateGex('AAPL', 100, []);
    expect(r.putCallRatioOi).toBeNull();
    expect(r.putCallRatioVolume).toBeNull();
    expect(r.diagnostics.clusteringDistancePct).toBeNull();
  });
});

describe('Ciclo 7 — F3: liquidityRating ausente na corretora não vira 4', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('payload sem liquidity-rating => liquidityRating null (nunca 4 assumido)', async () => {
    const payload = {
      data: {
        items: [
          {
            symbol: 'QQQ',
            'implied-volatility-index-rank': '0.42',
            'implied-volatility-percentile': '0.55',
            'implied-volatility-30-day': '0.18',
            'updated-at': '2026-09-10T12:00:00Z',
          },
        ],
      },
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve(payload) }));
    const metrics = await tastyMarketService.getMarketMetrics(['QQQ'], true);
    expect(metrics['QQQ']).toBeDefined();
    expect(metrics['QQQ'].liquidityRating).toBeNull();
  });
});
