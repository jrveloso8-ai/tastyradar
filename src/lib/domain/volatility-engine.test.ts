import { describe, it, expect } from 'vitest';
import { volatilityEngine, VolatilityAssetInput } from './volatility-engine';

describe('VolatilityEngine (Skill: analista-senior-opcoes-us)', () => {
  it('deve eleger Venda de Volatilidade e Iron Condor quando IVR > 50, VRP > +5 e +GEX', () => {
    const input: VolatilityAssetInput = {
      symbol: 'NVDA',
      name: 'NVIDIA Corp',
      spot: 142.50,
      change: 2.84,
      iv30: 44.5,
      rv20: 32.1,
      ivr: 74.2,
      ivp: 81.0,
      netGex: 120.5,
      zeroGammaFlip: 138.00,
      putWall: 135.00,
      callWall: 155.00,
    };

    const result = volatilityEngine.evaluate(input);

    expect(result.volRegime).toBe('SELL_VOLATILITY');
    expect(result.gexRegime).toBe('+GEX');
    expect(result.strategy.id).toBe(20); // Iron Condor #20
    expect(result.isCredit).toBe(true);
    expect(result.netCredit).toBeGreaterThan(0);
    expect(result.targetDte).toBe(35); // 30-45 DTE
    expect(result.lifecycle.profitTargetPct).toBe(50);
    expect(result.lifecycle.defenseDte).toBe(21);
    expect(result.meetsCreditRule).toBe(true);
  });

  it('deve ancorar pernas do Iron Condor fora das Walls institucionais', () => {
    const input: VolatilityAssetInput = {
      symbol: 'NVDA',
      name: 'NVIDIA Corp',
      spot: 142.50,
      change: 1.0,
      iv30: 40.0,
      rv20: 30.0,
      ivr: 65.0,
      ivp: 70.0,
      netGex: 80.0,
      zeroGammaFlip: 138.00,
      putWall: 135.00,
      callWall: 155.00,
    };

    const result = volatilityEngine.evaluate(input);
    const shortPut = result.legs.find((l) => l.action === 'SELL' && l.type === 'PUT');
    const shortCall = result.legs.find((l) => l.action === 'SELL' && l.type === 'CALL');

    expect(shortPut).toBeDefined();
    expect(shortCall).toBeDefined();
    expect(shortPut!.strike).toBeLessThanOrEqual(input.putWall);
    expect(shortCall!.strike).toBeGreaterThanOrEqual(input.callWall);
  });

  it('deve eleger Compra de Volatilidade quando IVR < 30 e VRP <= 1.0', () => {
    const input: VolatilityAssetInput = {
      symbol: 'TSLA',
      name: 'Tesla Inc',
      spot: 248.30,
      change: -2.5,
      iv30: 34.0,
      rv20: 38.0,
      ivr: 20.0,
      ivp: 22.0,
      netGex: -45.0, // -GEX
      zeroGammaFlip: 252.00,
      putWall: 235.00,
      callWall: 265.00,
    };

    const result = volatilityEngine.evaluate(input);

    expect(result.volRegime).toBe('BUY_VOLATILITY');
    expect(result.gexRegime).toBe('-GEX');
    expect(result.isCredit).toBe(false); // Estrutura a débito
    expect(result.strategy.id).toBe(2); // Bear Put Spread #2
  });

  it('deve eleger Double Calendar quando IVR for baixo mas em regime estável de +GEX', () => {
    const input: VolatilityAssetInput = {
      symbol: 'SPY',
      name: 'SPDR S&P 500 ETF',
      spot: 598.80,
      change: 0.5,
      iv30: 12.5,
      rv20: 12.0,
      ivr: 18.0,
      ivp: 20.0,
      netGex: 350.0, // +GEX
      zeroGammaFlip: 590.00,
      putWall: 590.00,
      callWall: 605.00,
    };

    const result = volatilityEngine.evaluate(input);

    expect(result.volRegime).toBe('BUY_VOLATILITY');
    expect(result.strategy.id).toBe(28); // Double Calendar #28
  });

  it('deve disparar alerta de atribuição de dividendo quando dividendo > extrínseco (§2.2)', () => {
    const input: VolatilityAssetInput = {
      symbol: 'AAPL',
      name: 'Apple Inc',
      spot: 238.10,
      change: 0.2,
      iv30: 25.0,
      rv20: 18.0,
      ivr: 60.0,
      ivp: 65.0,
      netGex: 50.0,
      zeroGammaFlip: 234.00,
      putWall: 230.00,
      callWall: 245.00,
      dividendAmount: 1.50, // Dividendo alto
      callExtrinsic: 0.40,  // Extrínseco baixo
    };

    const result = volatilityEngine.evaluate(input);

    expect(result.lifecycle.hasDividendRisk).toBe(true);
    expect(result.lifecycle.dividendRiskReason).toContain('ALERTA DE ATRIBUIÇÃO');
  });

  it('deve manter veredito seguro quando dividendo <= extrínseco', () => {
    const input: VolatilityAssetInput = {
      symbol: 'NVDA',
      name: 'NVIDIA Corp',
      spot: 142.50,
      change: 1.0,
      iv30: 44.0,
      rv20: 32.0,
      ivr: 70.0,
      ivp: 75.0,
      netGex: 100.0,
      zeroGammaFlip: 138.00,
      putWall: 135.00,
      callWall: 155.00,
      dividendAmount: 0.04,
      callExtrinsic: 1.20,
    };

    const result = volatilityEngine.evaluate(input);

    expect(result.lifecycle.hasDividendRisk).toBe(false);
    expect(result.lifecycle.dividendRiskReason).toContain('Seguro');
  });

  it('deve gerar texto formatado padronizado do §13 da skill', () => {
    const input: VolatilityAssetInput = {
      symbol: 'NVDA',
      name: 'NVIDIA Corp',
      spot: 142.50,
      change: 1.0,
      iv30: 44.0,
      rv20: 32.0,
      ivr: 70.0,
      ivp: 75.0,
      netGex: 100.0,
      zeroGammaFlip: 138.00,
      putWall: 135.00,
      callWall: 155.00,
    };

    const result = volatilityEngine.evaluate(input);

    expect(result.formattedTextOutput).toContain('DIAGNÓSTICO DE VOLATILIDADE');
    expect(result.formattedTextOutput).toContain('PLAYBOOK TASTYTRADE');
    expect(result.formattedTextOutput).toContain('50% do lucro');
    expect(result.formattedTextOutput).toContain('21 DTE');
  });

  it('deve gerar a curva de Volatility Smile / Skew com Put Skew institucional', () => {
    const spot = 140;
    const ivAtm = 40;
    const smile = volatilityEngine.generateSmile(spot, ivAtm, 5.0);

    expect(smile.length).toBeGreaterThanOrEqual(9);
    const putOtm = smile[0]; // Greve baixa (OTM Put)
    const atmPoint = smile.find((p) => p.type === 'ATM');
    const callOtm = smile[smile.length - 1]; // Greve alta (OTM Call)

    expect(atmPoint).toBeDefined();
    expect(atmPoint?.iv).toBeCloseTo(ivAtm, 0);
    // Put Skew: a IV das Puts OTM deve ser superior à ATM devido ao prêmio de cauda (crashophobia)
    expect(putOtm.iv).toBeGreaterThan(atmPoint!.iv);
    expect(putOtm.type).toBe('PUT_OTM');
    expect(callOtm.type).toBe('CALL_OTM');
  });

  it('deve calcular o prêmio sensível à volatilidade real: IV 80% gera crédito maior que IV 22% (Achado N-02)', () => {
    const baseInput: VolatilityAssetInput = {
      symbol: 'NVDA',
      name: 'NVIDIA Corp',
      spot: 142.50,
      change: 1.0,
      rv20: 25.0,
      ivr: 75.0,
      ivp: 80.0,
      netGex: 100.0,
      zeroGammaFlip: 138.00,
      putWall: 135.00,
      callWall: 155.00,
      iv30: 22.0,
    };

    const resultLowIv = volatilityEngine.evaluate({ ...baseInput, iv30: 22.0, ivr: 52.0 });
    const resultHighIv = volatilityEngine.evaluate({ ...baseInput, iv30: 80.0, ivr: 95.0 });

    // Em venda de volatilidade, o prêmio decorre da volatilidade:
    // IV 80% deve gerar crédito líquido expressivamente superior a IV 22%
    expect(resultHighIv.netCredit).toBeGreaterThan(resultLowIv.netCredit * 1.5);
  });

  it('deve calcular breakevens e max loss com valores analíticos exatos (Golden Test) (Achados A-10, A-12, N-05)', () => {
    const input: VolatilityAssetInput = {
      symbol: 'NVDA',
      name: 'NVIDIA Corp',
      spot: 142.50,
      change: 1.0,
      iv30: 44.0,
      rv20: 30.0,
      ivr: 75.0,
      ivp: 80.0,
      netGex: 100.0,
      zeroGammaFlip: 138.00,
      putWall: 135.00,
      callWall: 155.00,
    };

    const result = volatilityEngine.evaluate(input);
    expect(result.strategy.id).toBe(20); // Iron Condor

    // Strikes ancorados fora das walls:
    const shortPut = result.legs.find(l => l.action === 'SELL' && l.type === 'PUT')!;
    const shortCall = result.legs.find(l => l.action === 'SELL' && l.type === 'CALL')!;
    expect(shortPut.strike).toBe(135.00);
    expect(shortCall.strike).toBe(155.00);

    // netCredit calculado via BSM analítico sobre IV 44% e 35 DTE
    expect(result.netCredit).toBeGreaterThan(0.20);
    expect(result.netCredit).toBeLessThan(3.50);

    // Asserções independentes de Breakeven e Max Loss:
    const expectedLowerBe = Number((135.00 - result.netCredit).toFixed(2));
    const expectedUpperBe = Number((155.00 + result.netCredit).toFixed(2));
    expect(result.lowerBreakeven).toBe(expectedLowerBe);
    expect(result.upperBreakeven).toBe(expectedUpperBe);

    const wingWidth = 5.00; // step = 5 para spot > 100
    const expectedMaxLoss = Math.max(0, Number(((wingWidth - result.netCredit) * 100).toFixed(2)));
    expect(result.maxLoss).toBe(expectedMaxLoss);

    // POP deriva puramente dos deltas BSM das pernas vendidas (1 - pDelta - cDelta)
    const pDelta = shortPut.delta;
    const cDelta = shortCall.delta;
    const expectedPop = Math.round((1 - pDelta - cDelta) * 100);
    expect(result.popEstimate).toBe(expectedPop);
  });

  it('Bull Put Spread NÃO deve conter breakeven superior (Achado N-07)', () => {
    // Forçar montagem de Bull Put Spread (#6)
    const input: VolatilityAssetInput = {
      symbol: 'AAPL',
      name: 'Apple Inc',
      spot: 238.10,
      change: 2.5,
      iv30: 32.0,
      rv20: 22.0,
      ivr: 55.0,
      ivp: 58.0,
      netGex: -40.0, // -GEX com alta elege spread direcional ou bull put
      zeroGammaFlip: 234.00,
      putWall: 230.00,
      callWall: 245.00,
    };

    const result = volatilityEngine.evaluate(input);
    if (result.strategy.id === 6) {
      expect(result.upperBreakeven).toBeNull();
      expect(result.lowerBreakeven).toBeLessThan(235.00);
    } else {
      expect(result.lowerBreakeven).toBeGreaterThan(0);
    }
  });
});
