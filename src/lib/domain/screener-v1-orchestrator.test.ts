import { describe, it, expect } from 'vitest';
import { OHLCVBar, ScreenerCandidateInput } from '../types/low-vol-screener.types';
import { CandidateMarketDataV1, runScreenerV1Pipeline } from './screener-v1-orchestrator';

describe('Orquestrador do Funil Screener V1 — Integração Ponta a Ponta', () => {
  function generateBars(
    barsCount: number,
    annualSpread: number,
    hasSqueezeRecent = false
  ): OHLCVBar[] {
    const bars: OHLCVBar[] = [];
    for (let i = 0; i < barsCount; i++) {
      const isRecent = i >= barsCount - 30;
      if (isRecent && hasSqueezeRecent) {
        // Compressão profunda nos últimos 30 dias (BBW muito baixo)
        bars.push({
          date: `2026-d-${String(i).padStart(3, '0')}`,
          open: 100,
          high: 100.05,
          low: 99.95,
          close: 100.01,
          volume: 200000,
        });
      } else {
        // Histórico normal com oscilação para gerar desvio padrão não-nulo
        const isHigh = i % 4 < 2;
        const spread = annualSpread;
        bars.push({
          date: `2026-d-${String(i).padStart(3, '0')}`,
          open: 100,
          high: isHigh ? 100 + spread * 1.5 : 100 - spread * 0.5,
          low: isHigh ? 100 + spread * 0.5 : 100 - spread * 1.5,
          close: isHigh ? 100 + spread : 100 - spread,
          volume: 300000,
        });
      }
    }
    return bars;
  }

  it('INTEGRAÇÃO TOTAL: conduz múltiplos candidatos pelo funil, aprovando apenas quem cumpre todas as camadas', () => {
    // 1. Candidato WINNER: Passa em todas as etapas
    const candWinner: ScreenerCandidateInput = {
      symbol: 'WINNER',
      sector: 'Technology',
      bars: generateBars(252, 4.0, true), // Alta vol anual com compressão nos últimos 30 dias
      barsProvenance: 'MEDIDO',
      barsSource: 'tastytrade-rest-candles',
    };

    // 2. Candidato FAIL_L0: Vol histórica baixa no ano
    const candFailL0: ScreenerCandidateInput = {
      symbol: 'FAIL_L0',
      sector: 'Healthcare',
      bars: generateBars(252, 0.4, false), // Baixa vol anual
      barsProvenance: 'MEDIDO',
      barsSource: 'tastytrade-rest-candles',
    };

    // 3. Candidato FAIL_L1: Alta vol anual, mas SEM squeeze recente
    const candFailL1: ScreenerCandidateInput = {
      symbol: 'FAIL_L1',
      sector: 'Financials',
      bars: generateBars(252, 3.8, false), // Alta vol contínua, sem squeeze
      barsProvenance: 'MEDIDO',
      barsSource: 'tastytrade-rest-candles',
    };

    // 4. Candidato FAIL_L2: Passa L0 e L1, mas IV Rank estourou 30.05%
    const candFailL2: ScreenerCandidateInput = {
      symbol: 'FAIL_L2',
      sector: 'Energy',
      bars: generateBars(252, 3.75, true), // Alta vol com squeeze
      barsProvenance: 'MEDIDO',
      barsSource: 'tastytrade-rest-candles',
    };

    // 5. Candidato FAIL_LIQ: Passa até L2, mas opções têm spread de 20%
    const candFailLiq: ScreenerCandidateInput = {
      symbol: 'FAIL_LIQ',
      sector: 'Consumer',
      bars: generateBars(252, 3.85, true), // Alta vol com squeeze (passa L0, L1, L2, cai na liquidez)
      barsProvenance: 'MEDIDO',
      barsSource: 'tastytrade-rest-candles',
    };

    // 6. Candidato FAIL_NO_CYCLE: Passa L0 e L1, mas não tem ciclo na janela 30-45 DTE
    const candFailNoCycle: ScreenerCandidateInput = {
      symbol: 'FAIL_NO_CYCLE',
      sector: 'Materials',
      bars: generateBars(252, 3.80, true), // Alta vol com squeeze
      barsProvenance: 'MEDIDO',
      barsSource: 'tastytrade-rest-candles',
    };

    // 7. Candidato FAIL_NO_IV: Passa L0 e L1, tem ciclo, mas histórico de IV é nulo
    const candFailNoIv: ScreenerCandidateInput = {
      symbol: 'FAIL_NO_IV',
      sector: 'Industrials',
      bars: generateBars(252, 3.78, true), // Alta vol com squeeze
      barsProvenance: 'MEDIDO',
      barsSource: 'tastytrade-rest-candles',
    };

    // Candidatos de controle de baixa vol para calibrar a distribuição estatística do universo (N=9)
    const candLow1: ScreenerCandidateInput = {
      symbol: 'LOW_1',
      sector: 'Utilities',
      bars: generateBars(252, 0.3, false),
      barsProvenance: 'MEDIDO',
      barsSource: 'tastytrade-rest-candles',
    };
    const candLow2: ScreenerCandidateInput = {
      symbol: 'LOW_2',
      sector: 'RealEstate',
      bars: generateBars(252, 0.5, false),
      barsProvenance: 'MEDIDO',
      barsSource: 'tastytrade-rest-candles',
    };

    const candidates = [
      candWinner,
      candFailL0,
      candFailL1,
      candFailL2,
      candFailLiq,
      candFailNoCycle,
      candFailNoIv,
      candLow1,
      candLow2,
    ];

    const defaultExpirations = [
      { expirationDate: '2026-10-23', daysToExpiration: 37, expirationType: 'Standard' },
    ];

    const outsideExpirations = [
      { expirationDate: '2026-09-25', daysToExpiration: 15, expirationType: 'Standard' },
      { expirationDate: '2026-11-20', daysToExpiration: 60, expirationType: 'Standard' },
    ];

    const liquidStrikes = [
      {
        strike: 95,
        callSymbol: 'C95',
        putSymbol: 'P95',
        callBid: 6.0,
        callAsk: 6.2,
        callOi: 1000,
        putBid: 1.0,
        putAsk: 1.05,
        putOi: 800,
      },
      {
        strike: 100, // Put OTM para spot=102
        callSymbol: 'C100',
        putSymbol: 'P100',
        callBid: 3.0,
        callAsk: 3.1,
        callOi: 1500,
        putBid: 2.1,
        putAsk: 2.18, // mid=2.14, spread=3.7% <= 10%, OI >= 250
        putOi: 900,
      },
      {
        strike: 105, // Call OTM para spot=102
        callSymbol: 'C105',
        putSymbol: 'P105',
        callBid: 1.8,
        callAsk: 1.88, // mid=1.84, spread=4.3% <= 10%, OI >= 250
        callOi: 1200,
        putBid: 4.8,
        putAsk: 5.0,
        putOi: 600,
      },
    ];

    const illiquidStrikes = [
      {
        strike: 100,
        callSymbol: 'C100',
        putSymbol: 'P100',
        callBid: 3.0,
        callAsk: 3.1,
        callOi: 1000,
        putBid: 2.0,
        putAsk: 2.6, // spread = 0.60 / 2.30 = 26% > 10%
        putOi: 500,
      },
      {
        strike: 105,
        callSymbol: 'C105',
        putSymbol: 'P105',
        callBid: 1.8,
        callAsk: 1.88,
        callOi: 1000,
        putBid: 4.8,
        putAsk: 5.0,
        putOi: 500,
      },
    ];

    const marketDataMap = new Map<string, CandidateMarketDataV1>([
      [
        'WINNER',
        {
          spotPrice: 102.0,
          chainStrikes: liquidStrikes,
          optionMetrics: {
            rawIvr: 0.18, // 18% <= 30%
            rawIvp: 0.22, // 22% <= 30%
            atmIv: 0.24,
            expirations: defaultExpirations,
          },
        },
      ],
      [
        'FAIL_L0',
        {
          spotPrice: 100.0,
          chainStrikes: liquidStrikes,
          optionMetrics: { rawIvr: 0.10, rawIvp: 0.10, atmIv: 0.15, expirations: defaultExpirations },
        },
      ],
      [
        'FAIL_L1',
        {
          spotPrice: 100.0,
          chainStrikes: liquidStrikes,
          optionMetrics: { rawIvr: 0.15, rawIvp: 0.15, atmIv: 0.25, expirations: defaultExpirations },
        },
      ],
      [
        'FAIL_L2',
        {
          spotPrice: 102.0,
          chainStrikes: liquidStrikes,
          optionMetrics: {
            rawIvr: 0.3005, // 30.05% > 30% (borda Ponto 3)
            rawIvp: 0.20,
            atmIv: 0.28,
            expirations: defaultExpirations,
          },
        },
      ],
      [
        'FAIL_LIQ',
        {
          spotPrice: 102.0,
          chainStrikes: illiquidStrikes, // Opções sem liquidez
          optionMetrics: {
            rawIvr: 0.15,
            rawIvp: 0.15,
            atmIv: 0.25,
            expirations: defaultExpirations,
          },
        },
      ],
      [
        'FAIL_NO_CYCLE',
        {
          spotPrice: 102.0,
          chainStrikes: liquidStrikes,
          optionMetrics: {
            rawIvr: 0.15,
            rawIvp: 0.15,
            atmIv: 0.25,
            expirations: outsideExpirations, // Sem ciclos na janela 30-45 DTE
          },
        },
      ],
      [
        'FAIL_NO_IV',
        {
          spotPrice: 102.0,
          chainStrikes: liquidStrikes,
          optionMetrics: {
            rawIvr: null, // Histórico ausente
            rawIvp: 0.15,
            atmIv: 0.25,
            expirations: defaultExpirations,
          },
        },
      ],
    ]);

    // Executa o pipeline completo (com maxSpotPrice: 200 para focar na validação das camadas L0..L3 deste teste)
    const results = runScreenerV1Pipeline(candidates, marketDataMap, {
      layer0: { minHvPercentile: 30, maxSpotPrice: 200 }, // corte calibrado para o universo sintético de N=9
    });

    expect(results).toHaveLength(9);

    // 1. Valida WINNER
    const winnerRes = results.find(r => r.candidate.symbol === 'WINNER')!;
    expect(winnerRes.status).toBe('APPROVED_FOR_EXECUTION');
    expect(winnerRes.strategy).toBeDefined();
    expect(winnerRes.strategy!.structureType).toBe('STRANGLE');
    expect(winnerRes.strategy!.callLeg.strike).toBe(105);
    expect(winnerRes.strategy!.putLeg.strike).toBe(95);
    expect(winnerRes.strategy!.provenance).toBe('ESTIMADO');

    // 2. Valida FAIL_L0
    const failL0Res = results.find(r => r.candidate.symbol === 'FAIL_L0')!;
    expect(failL0Res.status).toBe('REJECTED');
    expect(failL0Res.rejectionStage).toBe('LAYER_0');
    expect(failL0Res.layer0.rejectionCode).toBe('HV_PERCENTILE_FAIL');

    // 3. Valida FAIL_L1
    const failL1Res = results.find(r => r.candidate.symbol === 'FAIL_L1')!;
    expect(failL1Res.status).toBe('REJECTED');
    expect(failL1Res.rejectionStage).toBe('LAYER_1');

    // 4. Valida FAIL_L2 (Borda de IV Rank 30.05%)
    const failL2Res = results.find(r => r.candidate.symbol === 'FAIL_L2')!;
    expect(failL2Res.status).toBe('REJECTED');
    expect(failL2Res.rejectionStage).toBe('LAYER_2');
    expect(failL2Res.layer2?.rejectionCode).toBe('IV_FILTER_FAIL');

    // 5. Valida FAIL_LIQ (Liquidez de opções)
    const failLiqRes = results.find(r => r.candidate.symbol === 'FAIL_LIQ')!;
    expect(failLiqRes.status).toBe('REJECTED');
    expect(failLiqRes.rejectionStage).toBe('LAYER_3_LIQUIDITY');

    // 6. Valida FAIL_NO_CYCLE (Propagação de NO_VALID_EXPIRATION_CYCLE até o output final)
    const failNoCycleRes = results.find(r => r.candidate.symbol === 'FAIL_NO_CYCLE')!;
    expect(failNoCycleRes.status).toBe('REJECTED');
    expect(failNoCycleRes.rejectionStage).toBe('LAYER_2');
    expect(failNoCycleRes.layer2?.rejectionCode).toBe('NO_VALID_EXPIRATION_CYCLE');
    expect(failNoCycleRes.rejectionReason).toContain('Nenhum ciclo de vencimento disponível');

    // 7. Valida FAIL_NO_IV (Propagação de IV_HISTORY_UNAVAILABLE com proveniência INDISPONIVEL)
    const failNoIvRes = results.find(r => r.candidate.symbol === 'FAIL_NO_IV')!;
    expect(failNoIvRes.status).toBe('REJECTED');
    expect(failNoIvRes.rejectionStage).toBe('LAYER_2');
    expect(failNoIvRes.layer2?.rejectionCode).toBe('IV_HISTORY_UNAVAILABLE');
    expect(failNoIvRes.layer2?.ivRank.provenance).toBe('INDISPONIVEL');
    expect(failNoIvRes.rejectionReason).toContain('Histórico de IV insuficiente');
  });

  it('TETO SETORIAL NO ORQUESTRADOR: rejeita candidato excedente do mesmo setor mantendo o de maior HV', () => {
    // 2 candidatos do mesmo setor 'Technology' com alta vol e compressão (ambos passariam isoladamente)
    const candTechHigh: ScreenerCandidateInput = {
      symbol: 'TECH_HIGH',
      sector: 'Technology',
      bars: generateBars(252, 4.5, true), // HV maior
      barsProvenance: 'MEDIDO',
      barsSource: 'tastytrade-rest-candles',
    };

    const candTechLow: ScreenerCandidateInput = {
      symbol: 'TECH_LOW',
      sector: 'Technology',
      bars: generateBars(252, 3.8, true), // HV alto, porém menor que TECH_HIGH
      barsProvenance: 'MEDIDO',
      barsSource: 'tastytrade-rest-candles',
    };

    // Candidatos de outros setores para formar o universo elegível (total 4 elegíveis -> teto ceil(0.25*4)=1)
    const candHealth: ScreenerCandidateInput = {
      symbol: 'HEALTH',
      sector: 'Healthcare',
      bars: generateBars(252, 4.0, true),
      barsProvenance: 'MEDIDO',
      barsSource: 'tastytrade-rest-candles',
    };

    const candFin: ScreenerCandidateInput = {
      symbol: 'FIN',
      sector: 'Financials',
      bars: generateBars(252, 3.9, true),
      barsProvenance: 'MEDIDO',
      barsSource: 'tastytrade-rest-candles',
    };

    // Candidatos de controle de baixa vol para calibrar percentil
    const candLow1: ScreenerCandidateInput = {
      symbol: 'LOW_1',
      sector: 'Utilities',
      bars: generateBars(252, 0.3, false),
      barsProvenance: 'MEDIDO',
      barsSource: 'tastytrade-rest-candles',
    };

    const candLow2: ScreenerCandidateInput = {
      symbol: 'LOW_2',
      sector: 'RealEstate',
      bars: generateBars(252, 0.4, false),
      barsProvenance: 'MEDIDO',
      barsSource: 'tastytrade-rest-candles',
    };

    const candidates = [candTechHigh, candTechLow, candHealth, candFin, candLow1, candLow2];

    const standardExpirations = [
      { expirationDate: '2026-10-23', daysToExpiration: 37, expirationType: 'Standard' },
    ];

    const liquidStrikes = [
      {
        strike: 100,
        callSymbol: 'C100',
        putSymbol: 'P100',
        callBid: 3.0,
        callAsk: 3.1,
        callOi: 1500,
        putBid: 2.1,
        putAsk: 2.18,
        putOi: 900,
      },
      {
        strike: 105,
        callSymbol: 'C105',
        putSymbol: 'P105',
        callBid: 1.8,
        callAsk: 1.88,
        callOi: 1200,
        putBid: 4.8,
        putAsk: 5.0,
        putOi: 600,
      },
    ];

    const marketDataMap = new Map<string, CandidateMarketDataV1>([
      [
        'TECH_HIGH',
        {
          spotPrice: 102.0,
          chainStrikes: liquidStrikes,
          optionMetrics: { rawIvr: 0.18, rawIvp: 0.20, atmIv: 0.24, expirations: standardExpirations },
        },
      ],
      [
        'TECH_LOW',
        {
          spotPrice: 102.0,
          chainStrikes: liquidStrikes,
          optionMetrics: { rawIvr: 0.18, rawIvp: 0.20, atmIv: 0.24, expirations: standardExpirations },
        },
      ],
      [
        'HEALTH',
        {
          spotPrice: 102.0,
          chainStrikes: liquidStrikes,
          optionMetrics: { rawIvr: 0.18, rawIvp: 0.20, atmIv: 0.24, expirations: standardExpirations },
        },
      ],
      [
        'FIN',
        {
          spotPrice: 102.0,
          chainStrikes: liquidStrikes,
          optionMetrics: { rawIvr: 0.18, rawIvp: 0.20, atmIv: 0.24, expirations: standardExpirations },
        },
      ],
    ]);

    const results = runScreenerV1Pipeline(candidates, marketDataMap, {
      layer0: { minHvPercentile: 30, maxSpotPrice: 200 }, // corte para qualificar os 4 de alta vol
    });

    // 1. O candidato de MENOR percentil de HV no mesmo setor (TECH_LOW) deve ser barrado no teto setorial
    const techLowRes = results.find(r => r.candidate.symbol === 'TECH_LOW')!;
    expect(techLowRes.status).toBe('REJECTED');
    expect(techLowRes.rejectionStage).toBe('LAYER_0');
    expect(techLowRes.layer0.passesHvPercentile).toBe(true);
    expect(techLowRes.layer0.passesStability).toBe(true);
    expect(techLowRes.layer0.sectorQuotaApproved).toBe(false);
    expect(techLowRes.layer0.rejectionCode).toBe('SECTOR_QUOTA_FAIL');
    expect(techLowRes.rejectionReason).toContain("Excedeu teto setorial de 1 ativo(s) para o setor 'Technology'");

    // 2. O candidato de MAIOR percentil de HV no mesmo setor (TECH_HIGH) deve ser aprovado na cota setorial e avançar
    const techHighRes = results.find(r => r.candidate.symbol === 'TECH_HIGH')!;
    expect(techHighRes.layer0.passesHvPercentile).toBe(true);
    expect(techHighRes.layer0.passesStability).toBe(true);
    expect(techHighRes.layer0.sectorQuotaApproved).toBe(true);
    expect(techHighRes.status).toBe('APPROVED_FOR_EXECUTION');
    expect(techHighRes.strategy).toBeDefined();
    expect(techHighRes.strategy!.structureType).toBe('STRANGLE');
  });

  it('FILTRO DE PREÇO: rejeita candidato na Camada 0 quando spot >= $100 com rejectionCode PRICE_ABOVE_THRESHOLD', () => {
    const candidate: ScreenerCandidateInput = {
      symbol: 'EXPENSIVE',
      sector: 'Technology',
      bars: generateBars(252, 4.0, true),
      barsProvenance: 'MEDIDO',
      barsSource: 'tastytrade-rest-candles',
    };

    const marketDataMap = new Map<string, CandidateMarketDataV1>([
      [
        'EXPENSIVE',
        {
          spotPrice: 150.0, // spot >= 100 default
          chainStrikes: [
            {
              strike: 155,
              callSymbol: 'C155',
              putSymbol: 'P155',
              callBid: 3.0,
              callAsk: 3.1,
              callOi: 1000,
              putBid: 2.0,
              putAsk: 2.1,
              putOi: 1000,
            },
          ],
        },
      ],
    ]);

    const results = runScreenerV1Pipeline([candidate], marketDataMap);

    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('REJECTED');
    expect(results[0].rejectionStage).toBe('LAYER_0');
    expect(results[0].layer0.passesPriceThreshold).toBe(false);
    expect(results[0].layer0.rejectionCode).toBe('PRICE_ABOVE_THRESHOLD');
    expect(results[0].layer0.rejectionReason).toContain('Preço spot ($150.00) acima do teto de $100.00');
  });
});
