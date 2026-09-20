import { describe, it, expect } from 'vitest';
import { Layer1Output } from '../types/low-vol-screener.types';
import { CandidateOptionMetrics, processLayer2 } from './screener-layer2';
import { selectExpirationCasoB, ExpirationOptionChainItem } from './expiration-selector';

describe('Camada 2 — Confirmação por IV Rank / IV Percentile e Seleção de Vencimento Caso B', () => {
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

  const defaultExpirations: ExpirationOptionChainItem[] = [
    { expirationDate: '2026-09-25', daysToExpiration: 9, expirationType: 'Weekly' },
    { expirationDate: '2026-10-09', daysToExpiration: 23, expirationType: 'Weekly' },
    { expirationDate: '2026-10-16', daysToExpiration: 30, expirationType: 'Weekly' },
    { expirationDate: '2026-10-23', daysToExpiration: 37, expirationType: 'Standard' }, // Mensal padrão na janela 30-45
    { expirationDate: '2026-10-30', daysToExpiration: 44, expirationType: 'Weekly' },
    { expirationDate: '2026-11-20', daysToExpiration: 65, expirationType: 'Standard' },
  ];

  it('BORDA CRÍTICA (Ponto 3): raw 0.3005 (30.05%) NÃO é truncado para 30.0% e DEVE ser REJEITADO', () => {
    // rawIvr = 0.3005 equivale a 30.05%
    // Se houvesse truncamento prévio para 1 casa decimal, viraria 30.0% e passaria por engano.
    // Em precisão completa (0.3005 * 100 = 30.05), o teste deve assertar REJEIÇÃO estrita!
    const metricsMap = new Map<string, CandidateOptionMetrics>([
      [
        'AAPL',
        {
          rawIvr: 0.3005,
          rawIvp: 0.20,
          atmIv: 0.28,
          expirations: defaultExpirations,
        },
      ],
    ]);

    const results = processLayer2([dummyL1Approved], metricsMap, { maxIvRank: 30.0, maxIvPercentile: 30.0 });
    const res = results[0];

    expect(res.passesIvFilter).toBe(false);
    expect(res.rejectionCode).toBe('IV_FILTER_FAIL');
    expect(res.ivRank.value).toBe(30.05); // Valor completo preservado
    expect(res.rejectionReason).toContain('30.05%');
  });

  it('BORDA ESTRITA: raw 0.3000 (30.00%) no limiar exato DEVE ser APROVADO', () => {
    const metricsMap = new Map<string, CandidateOptionMetrics>([
      [
        'AAPL',
        {
          rawIvr: 0.3000,
          rawIvp: 0.3000,
          atmIv: 0.25,
          expirations: defaultExpirations,
        },
      ],
    ]);

    const results = processLayer2([dummyL1Approved], metricsMap, { maxIvRank: 30.0, maxIvPercentile: 30.0 });
    const res = results[0];

    expect(res.passesIvFilter).toBe(true);
    expect(res.ivRank.value).toBe(30.0);
    expect(res.ivPercentile.value).toBe(30.0);
    expect(res.rejectionCode).toBeUndefined();
  });

  it('AMOSTRA REAL TASTYTRADE: avalia métricas brutas (0.133828996 e 0.090843054) com escala correta', () => {
    // Amostra real de NVDA do arquivo market-metrics-nvda.sample.json
    const metricsMap = new Map<string, CandidateOptionMetrics>([
      [
        'AAPL',
        {
          rawIvr: 0.133828996,
          rawIvp: 0.090843054,
          atmIv: 0.379462751,
          expirations: defaultExpirations,
        },
      ],
    ]);

    const results = processLayer2([dummyL1Approved], metricsMap);
    const res = results[0];

    expect(res.passesIvFilter).toBe(true);
    // Escala completa multiplicada por 100
    expect(res.ivRank.value).toBeCloseTo(13.3829, 4);
    expect(res.ivPercentile.value).toBeCloseTo(9.0843, 4);
    expect(res.atmIv.value).toBe(37.95);
    expect(res.ivRank.provenance).toBe('MEDIDO');
    expect(res.ivPercentile.provenance).toBe('MEDIDO');
  });

  it('OPERADOR AND: rejeita candidato se IV Rank <= 30 mas IV Percentile > 30', () => {
    const metricsMap = new Map<string, CandidateOptionMetrics>([
      [
        'AAPL',
        {
          rawIvr: 0.15, // 15% (ok)
          rawIvp: 0.45, // 45% (estourou)
          atmIv: 0.28,
          expirations: defaultExpirations,
        },
      ],
    ]);

    const results = processLayer2([dummyL1Approved], metricsMap);
    const res = results[0];

    expect(res.passesIvFilter).toBe(false);
    expect(res.rejectionCode).toBe('IV_FILTER_FAIL');
  });

  it('FALHA ASSIMÉTRICA 1: se rawIvr estiver presente mas rawIvp for null, rejeita com IV_HISTORY_UNAVAILABLE', () => {
    const metricsMap = new Map<string, CandidateOptionMetrics>([
      [
        'AAPL',
        {
          rawIvr: 0.20, // Presente
          rawIvp: null, // Ausente
          atmIv: 0.25,
          expirations: defaultExpirations,
        },
      ],
    ]);

    const results = processLayer2([dummyL1Approved], metricsMap);
    const res = results[0];

    expect(res.passesIvFilter).toBe(false);
    expect(res.rejectionCode).toBe('IV_HISTORY_UNAVAILABLE');
    expect(res.ivPercentile.provenance).toBe('INDISPONIVEL');
    expect(res.rejectionReason).toContain('Histórico de IV insuficiente');
  });

  it('FALHA ASSIMÉTRICA 2: se rawIvp estiver presente mas rawIvr for null, rejeita com IV_HISTORY_UNAVAILABLE', () => {
    const metricsMap = new Map<string, CandidateOptionMetrics>([
      [
        'AAPL',
        {
          rawIvr: null, // Ausente
          rawIvp: 0.20, // Presente
          atmIv: 0.25,
          expirations: defaultExpirations,
        },
      ],
    ]);

    const results = processLayer2([dummyL1Approved], metricsMap);
    const res = results[0];

    expect(res.passesIvFilter).toBe(false);
    expect(res.rejectionCode).toBe('IV_HISTORY_UNAVAILABLE');
    expect(res.ivRank.provenance).toBe('INDISPONIVEL');
    expect(res.rejectionReason).toContain('Histórico de IV insuficiente');
  });

  it('PROPAGAÇÃO DE CÓDIGO: se não houver ciclo na janela 30-45 DTE, rejeita com NO_VALID_EXPIRATION_CYCLE', () => {
    const outsideCycles: ExpirationOptionChainItem[] = [
      { expirationDate: '2026-09-25', daysToExpiration: 15, expirationType: 'Standard' },
      { expirationDate: '2026-11-20', daysToExpiration: 60, expirationType: 'Standard' },
    ];

    const metricsMap = new Map<string, CandidateOptionMetrics>([
      [
        'AAPL',
        {
          rawIvr: 0.20,
          rawIvp: 0.20,
          atmIv: 0.25,
          expirations: outsideCycles,
        },
      ],
    ]);

    const results = processLayer2([dummyL1Approved], metricsMap);
    const res = results[0];

    expect(res.passesIvFilter).toBe(false);
    expect(res.rejectionCode).toBe('NO_VALID_EXPIRATION_CYCLE');
    expect(res.rejectionReason).toContain('Nenhum ciclo de vencimento disponível');
  });

  describe('Seleção de Vencimento Caso B (DTE 30-45d)', () => {
    it('seleciona ciclo mensal padrão (Standard) dentro da janela 30-45 DTE', () => {
      const selected = selectExpirationCasoB(defaultExpirations, { minDte: 30, maxDte: 45 });
      expect(selected).not.toBeNull();
      expect(selected!.expirationDate).toBe('2026-10-23');
      expect(selected!.dte).toBe(37);
      expect(selected!.isMonthlyStandard).toBe(true);
      expect(selected!.selectionRule).toBe('CASO_B_SQUEEZE_GERAL');
      expect(selected!.provenance).toBe('DERIVADO');
    });

    it('EMPATE GENUÍNO DE DISTÂNCIA: entre 35 DTE e 41 DTE (ambos a 3 dias do target 38), escolhe o de MAIOR DTE (41 DTE) independentemente da ordem do array', () => {
      // Ordem 1: 35 antes de 41
      const orderA: ExpirationOptionChainItem[] = [
        { expirationDate: '2026-10-20', daysToExpiration: 35, expirationType: 'Standard' }, // |35-38| = 3
        { expirationDate: '2026-10-26', daysToExpiration: 41, expirationType: 'Standard' }, // |41-38| = 3 (empate!)
      ];
      const selectedA = selectExpirationCasoB(orderA, { minDte: 30, maxDte: 45, targetDte: 38 });
      expect(selectedA).not.toBeNull();
      expect(selectedA!.dte).toBe(41); // Regra determinística: maior DTE
      expect(selectedA!.expirationDate).toBe('2026-10-26');

      // Ordem 2: 41 antes de 35 (inversa)
      const orderB: ExpirationOptionChainItem[] = [
        { expirationDate: '2026-10-26', daysToExpiration: 41, expirationType: 'Standard' },
        { expirationDate: '2026-10-20', daysToExpiration: 35, expirationType: 'Standard' },
      ];
      const selectedB = selectExpirationCasoB(orderB, { minDte: 30, maxDte: 45, targetDte: 38 });
      expect(selectedB).not.toBeNull();
      expect(selectedB!.dte).toBe(41); // Regra determinística: continua escolhendo 41 DTE
      expect(selectedB!.expirationDate).toBe('2026-10-26');
    });

    it('retorna null se nenhum ciclo de vencimento cair na janela 30-45 DTE', () => {
      const outsideCycles: ExpirationOptionChainItem[] = [
        { expirationDate: '2026-09-25', daysToExpiration: 15, expirationType: 'Standard' },
        { expirationDate: '2026-11-20', daysToExpiration: 60, expirationType: 'Standard' },
      ];

      const selected = selectExpirationCasoB(outsideCycles, { minDte: 30, maxDte: 45 });
      expect(selected).toBeNull();
    });
  });
});
