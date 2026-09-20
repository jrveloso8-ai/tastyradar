import { describe, it, expect } from 'vitest';
import { Layer2Output } from '../types/low-vol-screener.types';
import { evaluateLegLiquidity } from './liquidity-filter';
import { ChainStrikeQuote, selectStrangleStructure } from './structure-selector';

describe('Filtros de Liquidez de Opções', () => {
  it('GOLDEN TEST: calcula spread relativo e valida liquidez conforme regras determinísticas', () => {
    // bid = 2.00, ask = 2.10
    // mid = (2.10 + 2.00) / 2 = 2.05
    // spread relativo = (2.10 - 2.00) / 2.05 = 0.10 / 2.05 = 0.0487804... ~= 4.88%
    // Como 4.88% <= 10.0% e OI 350 >= 250 (OTM), DEVE ser aprovado
    const evalRes = evaluateLegLiquidity({
      symbol: 'AAPL_261023_C105',
      strike: 105,
      optionType: 'CALL',
      isAtm: false,
      bid: 2.00,
      ask: 2.10,
      openInterest: 350,
      source: 'tastytrade-live-chain',
    });

    expect(evalRes.leg.mid).toBe(2.05);
    expect(evalRes.leg.relativeSpread).toBeCloseTo(0.0488, 4);
    expect(evalRes.leg.passesLiquidity).toBe(true);
    expect(evalRes.rejectionCode).toBeUndefined();
    expect(evalRes.leg.provenance).toBe('MEDIDO');
  });

  it('rejeita perna com spread relativo acima do teto de 10% com código LIQUIDITY_SPREAD_FAIL', () => {
    // bid = 1.00, ask = 1.30 => mid = 1.15 => spread = 0.30 / 1.15 = 26.09% > 10%
    const evalRes = evaluateLegLiquidity({
      symbol: 'AAPL_261023_C110',
      strike: 110,
      optionType: 'CALL',
      isAtm: false,
      bid: 1.00,
      ask: 1.30,
      openInterest: 1000,
    });

    expect(evalRes.leg.passesLiquidity).toBe(false);
    expect(evalRes.rejectionCode).toBe('LIQUIDITY_SPREAD_FAIL');
    expect(evalRes.rejectionReason).toContain('26.09% acima do teto de 10%');
  });

  it('rejeita perna com Open Interest abaixo do mínimo diferenciado (250 para OTM e 500 para ATM)', () => {
    // Caso 1: OTM com OI = 200 (< 250)
    const evalOtm = evaluateLegLiquidity({
      symbol: 'AAPL_261023_P95',
      strike: 95,
      optionType: 'PUT',
      isAtm: false,
      bid: 1.50,
      ask: 1.55, // spread = 3.28% (ok)
      openInterest: 200, // falha no OI
    });
    expect(evalOtm.leg.passesLiquidity).toBe(false);
    expect(evalOtm.rejectionCode).toBe('LIQUIDITY_OI_FAIL');
    expect(evalOtm.rejectionReason).toContain('abaixo do mínimo de 250 (OTM)');

    // Caso 2: ATM com OI = 400 (< 500 para ATM)
    const evalAtm = evaluateLegLiquidity({
      symbol: 'AAPL_261023_C100',
      strike: 100,
      optionType: 'CALL',
      isAtm: true,
      bid: 3.00,
      ask: 3.10, // spread = 3.28% (ok)
      openInterest: 400, // falha no OI ATM
    });
    expect(evalAtm.leg.passesLiquidity).toBe(false);
    expect(evalAtm.rejectionCode).toBe('LIQUIDITY_OI_FAIL');
    expect(evalAtm.rejectionReason).toContain('abaixo do mínimo de 500 (ATM)');
  });
});

describe('Seleção de Estrutura — Strangle OTM Default (Caso B)', () => {
  const dummyL2Candidate: Layer2Output = {
    symbol: 'AAPL',
    sector: 'Technology',
    hv12m: { value: 35.0, provenance: 'DERIVADO', source: 'garman-klass' },
    hv12mTrimmed: { value: 32.0, provenance: 'DERIVADO', source: 'garman-klass-trimmed' },
    hvDropRatio: { value: 0.0857, provenance: 'DERIVADO', source: 'drop-ratio' },
    hv12mPercentile: { value: 75.0, provenance: 'DERIVADO', source: 'percentile' },
    passesHvPercentile: true,
    passesStability: true,
    sectorQuotaApproved: true,
    bbwCurrent: { value: 4.2, provenance: 'DERIVADO', source: 'bbw-20-2' },
    bbwHistoryPercentile: { value: 12.0, provenance: 'DERIVADO', source: 'bbw-percentile' },
    passesSqueeze: true,
    selectedExpiration: {
      expirationDate: '2026-10-23',
      dte: 37,
      selectionRule: 'CASO_B_SQUEEZE_GERAL',
      bufferDaysApplied: 0,
      isMonthlyStandard: true,
      provenance: 'DERIVADO',
      source: 'expiration-selector-caso-b',
    },
    atmIv: { value: 25.0, provenance: 'MEDIDO', source: 'tastytrade-market-metrics' },
    ivRank: { value: 18.5, provenance: 'MEDIDO', source: 'tastytrade-market-metrics' },
    ivPercentile: { value: 22.0, provenance: 'MEDIDO', source: 'tastytrade-market-metrics' },
    passesIvFilter: true,
  };

  const sampleChainQuotes: ChainStrikeQuote[] = [
    {
      strike: 95,
      callSymbol: 'AAPL_261023_C95',
      putSymbol: 'AAPL_261023_P95',
      callBid: 7.20,
      callAsk: 7.40,
      callOi: 1200,
      putBid: 1.10,
      putAsk: 1.15,
      putOi: 850,
    },
    {
      strike: 100, // Put OTM esperada para spot = 102.50
      callSymbol: 'AAPL_261023_C100',
      putSymbol: 'AAPL_261023_P100',
      callBid: 3.80,
      callAsk: 3.90,
      callOi: 2400,
      putBid: 2.20,
      putAsk: 2.28, // mid=2.24, spread = 0.08 / 2.24 = 3.57%
      putOi: 1500, // OI >= 250
    },
    {
      strike: 105, // Call OTM esperada para spot = 102.50
      callSymbol: 'AAPL_261023_C105',
      putSymbol: 'AAPL_261023_P105',
      callBid: 1.80,
      callAsk: 1.88, // mid=1.84, spread = 0.08 / 1.84 = 4.35%
      callOi: 3200, // OI >= 250
      putBid: 4.80,
      putAsk: 5.00,
      putOi: 900,
    },
    {
      strike: 110,
      callSymbol: 'AAPL_261023_C110',
      putSymbol: 'AAPL_261023_P110',
      callBid: 0.70,
      callAsk: 0.75,
      callOi: 1800,
      putBid: 8.50,
      putAsk: 8.80,
      putOi: 600,
    },
  ];

  it('seleciona deterministicamente os strikes mais próximos de 25 Delta com BSM para spot em 102.50', () => {
    const spotPrice = 102.50;
    const result = selectStrangleStructure({
      layer2Candidate: dummyL2Candidate,
      spotPrice,
      strikes: sampleChainQuotes,
    });

    expect(result.success).toBe(true);
    expect(result.strategy).toBeDefined();

    const strat = result.strategy!;
    expect(strat.structureType).toBe('STRANGLE');
    expect(strat.positionDirection).toBe('LONG');
    expect(strat.totalDebitMid).toBe(2.97); // 0.725 (call 110 mid) + 2.24 (put 100 mid) = 2.965 -> 2.97
    expect(strat.symbol).toBe('AAPL');
    expect(strat.callLeg.strike).toBe(110);
    expect(strat.callLeg.action).toBe('BUY');
    expect(strat.callLeg.delta).toBeDefined();
    expect(strat.callLeg.delta?.provenance).toBe('ESTIMADO');
    expect(strat.callLeg.delta?.source).toBe('black-scholes-merton-delta (taxa livre de risco fixa 4.5%)');

    expect(strat.putLeg.strike).toBe(100);
    expect(strat.putLeg.action).toBe('BUY');
    expect(strat.putLeg.delta).toBeDefined();
    expect(strat.putLeg.delta?.provenance).toBe('ESTIMADO');
    expect(strat.putLeg.delta?.source).toBe('black-scholes-merton-delta (taxa livre de risco fixa 4.5%)');

    expect(strat.callLeg.passesLiquidity).toBe(true);
    expect(strat.putLeg.passesLiquidity).toBe(true);

    // Valida motivo determinístico registrado
    expect(strat.deterministicReason).toContain('STRANGLE default eleito');
    expect(strat.deterministicReason).toContain('delta-alvo 25 (OTM)');

    // Valida proveniência combinada estrita (contaminada por delta ESTIMADO)
    expect(strat.provenance).toBe('ESTIMADO');
  });

  it('descarta o candidato se a perna Put OTM falhar no filtro de liquidez (ex: spread > 10%)', () => {
    // Injeta spread largo de 25% na Put 100 (bid=2.00, ask=2.60 => mid=2.30 => spread=26.08%)
    const badSpreadQuotes = sampleChainQuotes.map(s => {
      if (s.strike === 100) {
        return { ...s, putBid: 2.00, putAsk: 2.60 };
      }
      return s;
    });

    const result = selectStrangleStructure({
      layer2Candidate: dummyL2Candidate,
      spotPrice: 102.50,
      strikes: badSpreadQuotes,
    });

    expect(result.success).toBe(false);
    expect(result.strategy).toBeUndefined();
    expect(result.rejectionCode).toBe('LIQUIDITY_SPREAD_FAIL');
    expect(result.rejectionReason).toContain('Perna Put OTM rejeitada na liquidez');
  });
});
