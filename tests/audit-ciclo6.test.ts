import { describe, it, expect } from 'vitest';
import { Layer1Output, Layer2Output } from '../src/lib/types/low-vol-screener.types';
import { CandidateOptionMetrics, processLayer2 } from '../src/lib/domain/screener-layer2';
import { ChainStrikeQuote, selectStrangleStructure } from '../src/lib/domain/structure-selector';

describe('Auditoria Ciclo 6 — N-01: Tratamento de IV e DTE ausentes ou inválidos', () => {
  const dummyL1Approved: Layer1Output = {
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
  };

  const defaultExpirations = [
    { expirationDate: '2026-10-23', daysToExpiration: 37, expirationType: 'Standard' },
  ];

  it('N-01: Camada 2 com atmIv null retorna passesIvFilter: false e atmIv.provenance === "INDISPONIVEL"', () => {
    const metricsMap = new Map<string, CandidateOptionMetrics>([
      [
        'AAPL',
        {
          rawIvr: 0.20,
          rawIvp: 0.20,
          atmIv: null, // IV ATM ausente
          expirations: defaultExpirations,
        },
      ],
    ]);

    const results = processLayer2([dummyL1Approved], metricsMap, { maxIvRank: 30.0, maxIvPercentile: 30.0 });
    const res = results[0];

    expect(res.passesIvFilter).toBe(false);
    expect(res.atmIv.provenance).toBe('INDISPONIVEL');
    expect(['IV_UNAVAILABLE', 'IV_HISTORY_UNAVAILABLE']).toContain(res.rejectionCode);
  });

  it('N-01: selectStrangleStructure com atmIv.value = 0 retorna success: false', () => {
    const dummyLayer2WithZeroIv: Layer2Output = {
      ...dummyL1Approved,
      selectedExpiration: {
        expirationDate: '2026-10-23',
        dte: 35,
        selectionRule: 'CASO_B_SQUEEZE_GERAL',
        bufferDaysApplied: 0,
        isMonthlyStandard: true,
        provenance: 'MEDIDO',
        source: 'expiration-selector',
      },
      atmIv: { value: 0, provenance: 'INDISPONIVEL', source: 'test' },
      ivRank: { value: 20, provenance: 'MEDIDO', source: 'test' },
      ivPercentile: { value: 20, provenance: 'MEDIDO', source: 'test' },
      passesIvFilter: true, // simulando passagem prévia mas valor de IV inválido/zerado
    };

    const strikes: ChainStrikeQuote[] = [
      { strike: 95, callSymbol: 'AAPL_C95', putSymbol: 'AAPL_P95', callBid: 6, callAsk: 6.2, callOi: 500, putBid: 1, putAsk: 1.1, putOi: 500 },
      { strike: 100, callSymbol: 'AAPL_C100', putSymbol: 'AAPL_P100', callBid: 2.5, callAsk: 2.6, callOi: 500, putBid: 2.5, putAsk: 2.6, putOi: 500 },
      { strike: 105, callSymbol: 'AAPL_C105', putSymbol: 'AAPL_P105', callBid: 1, callAsk: 1.1, callOi: 500, putBid: 6, putAsk: 6.2, putOi: 500 },
    ];

    const res = selectStrangleStructure({
      layer2Candidate: dummyLayer2WithZeroIv,
      spotPrice: 100,
      strikes,
    });

    expect(res.success).toBe(false);
    expect(res.rejectionCode).toBeDefined();
  });

  it('N-01: selectStrangleStructure com dte = 0 retorna success: false', () => {
    const dummyLayer2WithZeroDte: Layer2Output = {
      ...dummyL1Approved,
      selectedExpiration: {
        expirationDate: '2026-10-23',
        dte: 0, // DTE inválido
        selectionRule: 'CASO_B_SQUEEZE_GERAL',
        bufferDaysApplied: 0,
        isMonthlyStandard: true,
        provenance: 'MEDIDO',
        source: 'expiration-selector',
      },
      atmIv: { value: 25, provenance: 'MEDIDO', source: 'test' },
      ivRank: { value: 20, provenance: 'MEDIDO', source: 'test' },
      ivPercentile: { value: 20, provenance: 'MEDIDO', source: 'test' },
      passesIvFilter: true,
    };

    const strikes: ChainStrikeQuote[] = [
      { strike: 95, callSymbol: 'AAPL_C95', putSymbol: 'AAPL_P95', callBid: 6, callAsk: 6.2, callOi: 500, putBid: 1, putAsk: 1.1, putOi: 500 },
      { strike: 100, callSymbol: 'AAPL_C100', putSymbol: 'AAPL_P100', callBid: 2.5, callAsk: 2.6, callOi: 500, putBid: 2.5, putAsk: 2.6, putOi: 500 },
      { strike: 105, callSymbol: 'AAPL_C105', putSymbol: 'AAPL_P105', callBid: 1, callAsk: 1.1, callOi: 500, putBid: 6, putAsk: 6.2, putOi: 500 },
    ];

    const res = selectStrangleStructure({
      layer2Candidate: dummyLayer2WithZeroDte,
      spotPrice: 100,
      strikes,
    });

    expect(res.success).toBe(false);
    expect(res.rejectionCode).toBeDefined();
  });
});

describe('Auditoria Ciclo 6 — N-02: Cotação ausente ou inconsistente tratada como INDISPONIVEL sem sentinela', () => {
  it('N-02: bid/ask ausentes devolvem provenance "INDISPONIVEL", relativeSpread nulo e passesLiquidity false', async () => {
    const { evaluateLegLiquidity } = await import('../src/lib/domain/liquidity-filter');

    // Cotação com bid/ask ausentes (null)
    const evalRes = evaluateLegLiquidity({
      symbol: 'AAPL_261023_C105',
      strike: 105,
      optionType: 'CALL',
      isAtm: false,
      bid: null as any,
      ask: null as any,
      openInterest: 500,
    });

    expect(evalRes.leg.passesLiquidity).toBe(false);
    expect(evalRes.leg.provenance).toBe('INDISPONIVEL');
    expect(evalRes.leg.relativeSpread).toBeNull();
  });

  it('N-02: bid > ask (cotação cruzada) devolve provenance "INDISPONIVEL", relativeSpread nulo e passesLiquidity false', async () => {
    const { evaluateLegLiquidity } = await import('../src/lib/domain/liquidity-filter');

    const evalRes = evaluateLegLiquidity({
      symbol: 'AAPL_261023_C105',
      strike: 105,
      optionType: 'CALL',
      isAtm: false,
      bid: 2.50,
      ask: 2.00, // Cotação cruzada
      openInterest: 500,
    });

    expect(evalRes.leg.passesLiquidity).toBe(false);
    expect(evalRes.leg.provenance).toBe('INDISPONIVEL');
    expect(evalRes.leg.relativeSpread).toBeNull();
  });

  it('N-02: bid=0 e ask=0 (mid <= 0) devolve provenance "INDISPONIVEL", relativeSpread nulo e passesLiquidity false', async () => {
    const { evaluateLegLiquidity } = await import('../src/lib/domain/liquidity-filter');

    const evalRes = evaluateLegLiquidity({
      symbol: 'AAPL_261023_C105',
      strike: 105,
      optionType: 'CALL',
      isAtm: false,
      bid: 0,
      ask: 0,
      openInterest: 500,
    });

    expect(evalRes.leg.passesLiquidity).toBe(false);
    expect(evalRes.leg.provenance).toBe('INDISPONIVEL');
    expect(evalRes.leg.relativeSpread).toBeNull();
  });
});

describe('Auditoria Ciclo 6 — N-03: Proveniência do Delta BSM e Contágio na Estratégia', () => {
  it('N-03: delta modelado por BSM com taxa fixa e rotulado ESTIMADO e contagia strategy.provenance', async () => {
    const { selectStrangleStructure } = await import('../src/lib/domain/structure-selector');

    const dummyLayer2: Layer2Output = {
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
        provenance: 'MEDIDO',
        source: 'expiration-selector',
      },
      atmIv: { value: 28, provenance: 'MEDIDO', source: 'tastytrade-market-metrics' },
      ivRank: { value: 20, provenance: 'MEDIDO', source: 'tastytrade-market-metrics' },
      ivPercentile: { value: 20, provenance: 'MEDIDO', source: 'tastytrade-market-metrics' },
      passesIvFilter: true,
    };

    const strikes: ChainStrikeQuote[] = [
      { strike: 90, callSymbol: 'AAPL_C90', putSymbol: 'AAPL_P90', callBid: 11, callAsk: 11.2, callOi: 500, putBid: 0.5, putAsk: 0.55, putOi: 500 },
      { strike: 95, callSymbol: 'AAPL_C95', putSymbol: 'AAPL_P95', callBid: 6, callAsk: 6.2, callOi: 500, putBid: 1.5, putAsk: 1.6, putOi: 500 },
      { strike: 100, callSymbol: 'AAPL_C100', putSymbol: 'AAPL_P100', callBid: 2.5, callAsk: 2.6, callOi: 500, putBid: 2.5, putAsk: 2.6, putOi: 500 },
      { strike: 105, callSymbol: 'AAPL_C105', putSymbol: 'AAPL_P105', callBid: 1.5, callAsk: 1.6, callOi: 500, putBid: 6, putAsk: 6.2, putOi: 500 },
      { strike: 110, callSymbol: 'AAPL_C110', putSymbol: 'AAPL_P110', callBid: 0.5, callAsk: 0.55, callOi: 500, putBid: 11, putAsk: 11.2, putOi: 500 },
    ].map((q) => ({ ...q, callSource: 'fixture-chain-quote', putSource: 'fixture-chain-quote' }));

    const res = selectStrangleStructure({
      layer2Candidate: dummyLayer2,
      spotPrice: 100,
      strikes,
    });

    expect(res.success).toBe(true);
    expect(res.strategy).toBeDefined();

    // 1. O delta deve ser ESTIMADO porque a taxa livre de risco é fixa (não medida de fonte externa)
    expect(res.callLeg?.delta?.provenance).toBe('ESTIMADO');
    expect(res.putLeg?.delta?.provenance).toBe('ESTIMADO');

    // 2. O rótulo da fonte do delta deve declarar a taxa fixa usada
    expect(res.callLeg?.delta?.source).toMatch(/4\.?5%/);
    expect(res.putLeg?.delta?.source).toMatch(/4\.?5%/);

    // 3. Contágio: a estratégia combina vencimento, pernas E os deltas; logo strategy.provenance NUNCA pode ser MEDIDO
    expect(res.strategy?.provenance).not.toBe('MEDIDO');
    expect(res.strategy?.provenance).toBe('ESTIMADO');
  });
});

describe('Auditoria Ciclo 6 — N-04: Eliminação de Fallback de Rótulo de Fonte', () => {
  it('N-04: chamada a evaluateLegLiquidity sem source NÃO devolve MEDIDO com rótulo "tastytrade-live-chain"', async () => {
    const { evaluateLegLiquidity } = await import('../src/lib/domain/liquidity-filter');

    const evalRes = evaluateLegLiquidity({
      symbol: 'AAPL_261023_C105',
      strike: 105,
      optionType: 'CALL',
      isAtm: false,
      bid: 2.0,
      ask: 2.1,
      openInterest: 500,
      // source ausente intencionalmente
    });

    expect(evalRes.leg.provenance).toBe('INDISPONIVEL');
    expect(evalRes.leg.source).not.toBe('tastytrade-live-chain');
    expect(evalRes.leg.passesLiquidity).toBe(false);
  });

  it('N-04: Camada 2 sem metrics.source NÃO devolve MEDIDO com rótulo "tastytrade-market-metrics"', async () => {
    const { processLayer2 } = await import('../src/lib/domain/screener-layer2');
    const dummyL1: Layer1Output = {
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
    };

    const metricsMap = new Map([
      [
        'AAPL',
        {
          rawIvr: 0.20,
          rawIvp: 0.20,
          atmIv: 0.25,
          expirations: [{ expirationDate: '2026-10-23', daysToExpiration: 37, expirationType: 'Standard' }],
          // source ausente intencionalmente
        },
      ],
    ]);

    const results = processLayer2([dummyL1], metricsMap as any, { maxIvRank: 30, maxIvPercentile: 30 });
    const res = results[0];

    expect(res.passesIvFilter).toBe(false);
    expect(res.ivRank.provenance).toBe('INDISPONIVEL');
    expect(res.ivRank.source).not.toBe('tastytrade-market-metrics');
  });
});

describe('Auditoria Ciclo 6 — Cerca ESLint: AST de Ternários Numéricos e Cobertura de Scripts', { timeout: 60000 }, () => {
  it('Cerca ESLint: barra ternários com fallback numérico em src/lib/domain (ex.: vol > 0 ? vol : 0.30)', async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { ESLint } = require('eslint') as { ESLint: any };
    const eslint = new ESLint();
    const [result] = await eslint.lintText('export const x = (vol: number) => vol > 0 ? vol : 0.30;\n', {
      filePath: 'src/lib/domain/mock-test-ternary.ts',
    });
    const hasForbiddenTernaryError = result.messages.some((m: { message: string }) =>
      m.message.includes('REGRA 00: Fallback numerico com ternario')
    );
    expect(hasForbiddenTernaryError).toBe(true);
  });

  it('Cerca ESLint: barra ternários com fallback numérico em scripts (ex.: dte > 0 ? dte : 35)', async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { ESLint } = require('eslint') as { ESLint: any };
    const eslint = new ESLint();
    const [result] = await eslint.lintText('export const d = (dte: number) => dte > 0 ? dte : 35;\n', {
      filePath: 'scripts/mock-test-ternary.ts',
    });
    const hasForbiddenTernaryError = result.messages.some((m: { message: string }) =>
      m.message.includes('REGRA 00: Fallback numerico com ternario')
    );
    expect(hasForbiddenTernaryError).toBe(true);
  });

  it('Cerca ESLint: permite o sinal legítimo `? 1 : -1`', async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { ESLint } = require('eslint') as { ESLint: any };
    const eslint = new ESLint();
    const [result] = await eslint.lintText('export const sign = (val: number) => val >= 0 ? 1 : -1;', {
      filePath: 'src/lib/domain/mock-test-sign.ts',
    });
    const hasForbiddenTernaryError = result.messages.some((m: { message: string }) =>
      m.message.includes('REGRA 00: Fallback numerico com ternario')
    );
    expect(hasForbiddenTernaryError).toBe(false);
  });

  it('B-03: barra o padrão do N-01 original — `m !== null ? m * 100 : 0` (0 NÃO é mais isento)', async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { ESLint } = require('eslint') as { ESLint: any };
    const eslint = new ESLint();
    for (const filePath of ['src/lib/domain/mock-zero.ts', 'scripts/mock-zero.ts']) {
      const [result] = await eslint.lintText(
        'export const a = (m: number | null) => (m !== null ? m * 100 : 0);',
        { filePath }
      );
      const barred = result.messages.some((m: { message: string }) =>
        m.message.includes('REGRA 00: Fallback numerico com ternario')
      );
      expect(barred, filePath).toBe(true);
    }
  });
});
