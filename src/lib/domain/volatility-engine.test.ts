import { describe, it, expect } from 'vitest';
import { classifyRegime, planStrategy, buildRecommendation, VolatilityAssetInput } from './volatility-engine';
import { OptionChainResult, OptionChainStrike, OptionChainExpiration } from '../services/tastytrade-market.service';
import { RealGreeksQuote } from '../services/tastytrade-dxlink.service';

/**
 * Suíte reescrita em 2026-09-08 junto com o motor. Antes testava `volatilityEngine.evaluate()`
 * (síncrono, sem IO, mas com strike/DTE/preço fabricados por fórmula — exatamente o padrão que
 * gerou o achado da BAC). O motor novo é dividido em 3 funções puras e testáveis sem rede:
 * `classifyRegime` (árvore de decisão vol/GEX — inalterada), `planStrategy` (escolhe strikes/
 * vencimento REAIS a partir de uma OptionChainResult mockada aqui) e `buildRecommendation`
 * (precifica com cotações/gregas REAIS mockadas aqui, no formato exato que a API da Tastytrade
 * devolve). Isso testa o comportamento de honestidade de dado (null quando falta cotação/grego
 * real) sem depender de rede — os mocks representam a forma da resposta real, não valores
 * inventados pelo próprio motor.
 */

function buildMockChain(spot: number, dte: number, strikeStep = 5, strikeCount = 12): OptionChainResult {
  const centerStrike = Math.round(spot / strikeStep) * strikeStep;
  const strikes: OptionChainStrike[] = [];
  for (let i = -strikeCount / 2; i <= strikeCount / 2; i++) {
    const strike = centerStrike + i * strikeStep;
    if (strike <= 0) continue;
    strikes.push({
      strike,
      callSymbol: `NVDA  260101C${String(strike * 1000).padStart(8, '0')}`,
      putSymbol: `NVDA  260101P${String(strike * 1000).padStart(8, '0')}`,
      callStreamerSymbol: `.NVDA260101C${strike}`,
      putStreamerSymbol: `.NVDA260101P${strike}`,
    });
  }
  const expiration: OptionChainExpiration = {
    expirationDate: '2026-01-01',
    daysToExpiration: dte,
    expirationType: 'Regular',
    settlementType: 'PM',
    strikes,
  };
  const farExpiration: OptionChainExpiration = {
    ...expiration,
    expirationDate: '2026-02-01',
    daysToExpiration: dte + 30,
  };
  return { symbol: 'NVDA', expirations: [expiration, farExpiration], source: 'tastytrade-live', fetchedAt: new Date().toISOString() };
}

function mockQuotesForPlan(plan: NonNullable<ReturnType<typeof planStrategy>>, mid = 1.5): Map<string, { bid: number | null; ask: number | null; mid: number | null }> {
  const quotes = new Map<string, { bid: number | null; ask: number | null; mid: number | null }>();
  for (const leg of plan.legs) {
    quotes.set(leg.occSymbol, { bid: mid - 0.05, ask: mid + 0.05, mid });
  }
  return quotes;
}

function mockGreeksForPlan(plan: NonNullable<ReturnType<typeof planStrategy>>, delta = 0.2, iv = 0.35): Map<string, RealGreeksQuote> {
  const greeks = new Map<string, RealGreeksQuote>();
  for (const leg of plan.legs) {
    greeks.set(leg.streamerSymbol, {
      symbol: leg.streamerSymbol,
      delta: leg.action === 'SELL' ? -delta : delta,
      gamma: 0.01,
      iv,
      openInterest: 500,
      lastPrice: null,
    });
  }
  return greeks;
}

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

describe('classifyRegime (árvore de decisão vol/GEX — sem IO)', () => {
  it('elege Venda de Volatilidade + Iron Condor quando IVR>50, VRP>=4 e +GEX', () => {
    const r = classifyRegime(baseInput);
    expect(r.volRegime).toBe('SELL_VOLATILITY');
    expect(r.gexRegime).toBe('+GEX');
    expect(r.strategy.id).toBe(20);
  });

  it('elege Compra de Volatilidade quando IVR<=30 e VRP<=1.0', () => {
    const input: VolatilityAssetInput = { ...baseInput, iv30: 22.0, rv20: 21.5, ivr: 25.0, netGex: 50.0 };
    const r = classifyRegime(input);
    expect(r.volRegime).toBe('BUY_VOLATILITY');
    expect(r.strategy.id).toBe(28); // +GEX -> Double Calendar
  });

  it('elege Bull Put Spread quando preço encostado na Put Wall em +GEX', () => {
    const input: VolatilityAssetInput = { ...baseInput, spot: 135.5, putWall: 135.0, callWall: 160.0 };
    const r = classifyRegime(input);
    expect(r.strategy.id).toBe(6);
  });
});

describe('planStrategy (strikes/vencimento REAIS a partir da cadeia)', () => {
  it('retorna null quando não há cadeia real', () => {
    expect(planStrategy(baseInput, null)).toBeNull();
  });

  it('só usa strikes que existem de fato na cadeia mockada (nunca um grid sintético)', () => {
    const chain = buildMockChain(142.5, 35, 5, 20);
    const validStrikes = new Set(chain.expirations[0].strikes.map((s) => s.strike));
    const plan = planStrategy(baseInput, chain);
    expect(plan).not.toBeNull();
    for (const leg of plan!.legs) {
      expect(validStrikes.has(leg.strike)).toBe(true);
    }
  });

  it('escolhe o vencimento real mais próximo do alvo, não um DTE fixo (regressão do achado BAC)', () => {
    // Cadeia com um vencimento real de 38 DTE (não 35) — o motor deve usar 38 real, não fabricar 35.
    const chain = buildMockChain(142.5, 38, 5, 20);
    const plan = planStrategy(baseInput, chain);
    expect(plan).not.toBeNull();
    expect(plan!.expiration.daysToExpiration).toBe(38);
  });

  it('retorna null se a cadeia não tiver strikes suficientes para montar a estrutura', () => {
    const chain = buildMockChain(142.5, 35, 5, 0); // só o strike central
    const plan = planStrategy(baseInput, chain);
    expect(plan).toBeNull();
  });
});

describe('buildRecommendation (precificação REAL — honestidade de dado)', () => {
  it('retorna null se qualquer perna eleita não tiver cotação real (nunca mistura real com modelo)', () => {
    const chain = buildMockChain(142.5, 35, 5, 20);
    const plan = planStrategy(baseInput, chain);
    expect(plan).not.toBeNull();
    const quotes = mockQuotesForPlan(plan!);
    // Remove a cotação de uma perna para simular indisponibilidade parcial
    const firstKey = quotes.keys().next().value!;
    quotes.delete(firstKey);
    const greeks = mockGreeksForPlan(plan!);
    const rec = buildRecommendation(baseInput, plan!, quotes, greeks);
    expect(rec).toBeNull();
  });

  it('monta a recomendação com preço/strike/vencimento reais quando todas as cotações existem', () => {
    const chain = buildMockChain(142.5, 35, 5, 20);
    const plan = planStrategy(baseInput, chain);
    const quotes = mockQuotesForPlan(plan!, 1.2);
    const greeks = mockGreeksForPlan(plan!);
    const rec = buildRecommendation(baseInput, plan!, quotes, greeks);
    expect(rec).not.toBeNull();
    expect(rec!.expirationDate).toBe(chain.expirations[0].expirationDate);
    expect(rec!.targetDte).toBe(chain.expirations[0].daysToExpiration);
    expect(rec!.dataQuality.pricedFromRealQuotes).toBe(true);
    for (const leg of rec!.legs) {
      expect(quotes.get(leg.occSymbol)?.mid).toBe(leg.midPrice);
    }
  });

  it('popEstimate fica null quando alguma perna vendida não tem delta real (nunca substitui por BSM)', () => {
    const chain = buildMockChain(142.5, 35, 5, 20);
    const plan = planStrategy(baseInput, chain);
    const quotes = mockQuotesForPlan(plan!);
    const greeks = mockGreeksForPlan(plan!);
    // Remove o delta de uma perna vendida
    for (const [key, g] of greeks.entries()) {
      const leg = plan!.legs.find((l) => l.streamerSymbol === key);
      if (leg?.action === 'SELL') {
        greeks.set(key, { ...g, delta: null });
        break;
      }
    }
    const rec = buildRecommendation(baseInput, plan!, quotes, greeks);
    expect(rec).not.toBeNull();
    expect(rec!.popEstimate).toBeNull();
    expect(rec!.dataQuality.greeksAvailable).toBe(false);
  });

  it('smileCurve fica null sem gregas reais por strike (não fabrica curva sintética)', () => {
    const chain = buildMockChain(142.5, 35, 5, 20);
    const plan = planStrategy(baseInput, chain);
    const quotes = mockQuotesForPlan(plan!);
    const greeks = mockGreeksForPlan(plan!);
    const rec = buildRecommendation(baseInput, plan!, quotes, greeks, null);
    expect(rec).not.toBeNull();
    expect(rec!.smileCurve).toBeNull();
    expect(rec!.dataQuality.smileAvailable).toBe(false);
  });

  it('breakevens do Iron Condor usam os strikes reais eleitos e o crédito real recebido', () => {
    const chain = buildMockChain(142.5, 35, 5, 20);
    const plan = planStrategy(baseInput, chain);
    expect(plan!.strategy.id).toBe(20);
    const quotes = mockQuotesForPlan(plan!, 1.0);
    const greeks = mockGreeksForPlan(plan!);
    const rec = buildRecommendation(baseInput, plan!, quotes, greeks)!;
    const shortPut = rec.legs.find((l) => l.action === 'SELL' && l.type === 'PUT')!;
    const shortCall = rec.legs.find((l) => l.action === 'SELL' && l.type === 'CALL')!;
    expect(rec.lowerBreakeven).toBeCloseTo(shortPut.strike - rec.netCredit, 2);
    expect(rec.upperBreakeven!).toBeCloseTo(shortCall.strike + rec.netCredit, 2);
  });
});
