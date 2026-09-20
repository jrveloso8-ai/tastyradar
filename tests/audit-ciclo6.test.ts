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
