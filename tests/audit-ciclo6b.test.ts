import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { evaluateLegLiquidity } from '../src/lib/domain/liquidity-filter';
import { ChainStrikeQuote, selectStrangleStructure } from '../src/lib/domain/structure-selector';
import { processLayer0 } from '../src/lib/domain/screener-layer0';
import { calculateBbwSeries } from '../src/lib/domain/screener-layer1';
import { processLayer2 } from '../src/lib/domain/screener-layer2';
import { testHvRobustness } from '../src/lib/domain/volatility-estimators';
import { Layer1Output, Layer2Output } from '../src/lib/types/low-vol-screener.types';

const SRC = 'chain-quote-source-under-test';

function buildChain(over: Partial<ChainStrikeQuote> = {}): ChainStrikeQuote[] {
  const strikes: ChainStrikeQuote[] = [];
  for (let k = 60; k <= 140; k += 2.5) {
    strikes.push({
      strike: k,
      callSymbol: `C${k}`,
      putSymbol: `P${k}`,
      callBid: 1,
      callAsk: 1.02,
      callOi: 5000,
      callSource: SRC,
      putBid: 1,
      putAsk: 1.02,
      putOi: 5000,
      putSource: SRC,
      ...over,
    });
  }
  return strikes;
}

const l2: Layer2Output = {
  symbol: 'X',
  sector: 'S',
  hv12m: { value: 30, provenance: 'DERIVADO', source: 'gk' },
  hv12mTrimmed: { value: 28, provenance: 'DERIVADO', source: 'gk' },
  hvDropRatio: { value: 0.05, provenance: 'DERIVADO', source: 'gk' },
  hv12mPercentile: { value: 80, provenance: 'DERIVADO', source: 'p' },
  passesHvPercentile: true,
  passesStability: true,
  sectorQuotaApproved: true,
  bbwCurrent: { value: 4, provenance: 'DERIVADO', source: 'b' },
  bbwHistoryPercentile: { value: 10, provenance: 'DERIVADO', source: 'b' },
  passesSqueeze: true,
  selectedExpiration: {
    expirationDate: '2026-10-23',
    dte: 37,
    selectionRule: 'CASO_B_SQUEEZE_GERAL',
    bufferDaysApplied: 0,
    isMonthlyStandard: true,
    provenance: 'DERIVADO',
    source: 'exp',
  },
  atmIv: { value: 30, provenance: 'MEDIDO', source: 's' },
  ivRank: { value: 10, provenance: 'MEDIDO', source: 's' },
  ivPercentile: { value: 10, provenance: 'MEDIDO', source: 's' },
  passesIvFilter: true,
};

describe('Ciclo 6b — B-02: fonte da perna rastreada a partir da chain (não assumida pelo seletor)', () => {
  it('B-02: chain SEM callSource/putSource => pernas INDISPONIVEL e estrutura rejeitada', () => {
    const chain = buildChain({ callSource: undefined, putSource: undefined });
    const r = selectStrangleStructure({ layer2Candidate: l2, spotPrice: 100, strikes: chain });
    expect(r.success).toBe(false);
    expect(r.callLeg?.provenance).toBe('INDISPONIVEL');
    expect(r.callLeg?.passesLiquidity).toBe(false);
  });

  it('B-02: chain COM fonte => o mesmo rótulo aparece em leg.source (não um literal do seletor)', () => {
    const r = selectStrangleStructure({ layer2Candidate: l2, spotPrice: 100, strikes: buildChain() });
    expect(r.success).toBe(true);
    expect(r.callLeg?.source).toBe(SRC);
    expect(r.putLeg?.source).toBe(SRC);
  });

  it('B-02: structure-selector.ts não contém o literal "tastytrade-live-chain"', () => {
    const code = fs.readFileSync(path.join(__dirname, '../src/lib/domain/structure-selector.ts'), 'utf8');
    expect(code).not.toContain('tastytrade-live-chain');
  });
});

describe('Ciclo 6b — N-05: Open Interest nunca é constante nem assumido', () => {
  it('N-05: OI ausente (null) => perna INDISPONIVEL, sem passar liquidez, OI permanece null', () => {
    const r = evaluateLegLiquidity({
      symbol: 'C',
      strike: 100,
      optionType: 'CALL',
      isAtm: false,
      bid: 1,
      ask: 1.02,
      openInterest: null,
      source: SRC,
    });
    expect(r.leg.provenance).toBe('INDISPONIVEL');
    expect(r.leg.passesLiquidity).toBe(false);
    expect(r.leg.openInterest).toBeNull();
    expect(r.rejectionCode).toBe('LIQUIDITY_OI_FAIL');
  });

  it('N-05: seletor com OI null nas pernas elegíveis rejeita a estrutura', () => {
    const chain = buildChain({ callOi: null, putOi: null });
    const r = selectStrangleStructure({ layer2Candidate: l2, spotPrice: 100, strikes: chain });
    expect(r.success).toBe(false);
    expect(r.callLeg?.openInterest).toBeNull();
  });

  it('N-05: scripts/run-shadow-screener.ts não fixa OI por literal numérico (ex.: callOi: 500)', () => {
    const code = fs.readFileSync(path.join(__dirname, '../scripts/run-shadow-screener.ts'), 'utf8');
    expect(/(call|put)Oi:\s*\d/.test(code)).toBe(false);
  });
});

describe('Ciclo 6b — B-04: custo da estrutura nunca fabricado', () => {
  it('B-04: totalDebitMid é exatamente a soma dos mids medidos das pernas', () => {
    const r = selectStrangleStructure({ layer2Candidate: l2, spotPrice: 100, strikes: buildChain() });
    expect(r.success).toBe(true);
    const sum = Number(((r.callLeg!.mid as number) + (r.putLeg!.mid as number)).toFixed(2));
    expect(r.strategy!.totalDebitMid).toBe(sum);
  });
});

describe('Ciclo 6b — fail-open removido dos módulos do screener', () => {
  it('Camada 0: spot desconhecido (sem cotação e sem barras) NÃO aprova o teto de preço', () => {
    const [res] = processLayer0([
      { symbol: 'ZZZ', sector: 'Financials', bars: [], barsProvenance: 'INDISPONIVEL', barsSource: 'x' },
    ]);
    expect(res.passesPriceThreshold).toBe(false);
    expect(res.spotPrice?.provenance).toBe('INDISPONIVEL');
  });

  it('Camada 1: SMA <= 0 não fabrica ponto com BBW = 0 (squeeze máximo)', () => {
    const closes = Array.from({ length: 25 }, (_, i) => ({
      date: `2026-01-${String(i + 1).padStart(2, '0')}`,
      close: -5,
    }));
    expect(calculateBbwSeries(closes)).toHaveLength(0);
  });

  it('Estimadores: HV nula/inválida NÃO devolve robusto (dropRatio 0 fabricado); lança erro', () => {
    const flat = Array.from({ length: 60 }, (_, i) => ({
      date: `d${i}`,
      open: 100,
      high: 100,
      low: 100,
      close: 100,
      volume: 1000,
    }));
    let outcome: boolean | string;
    try {
      outcome = testHvRobustness(flat as any).isRobust;
    } catch {
      outcome = 'lancou';
    }
    expect(outcome).toBe('lancou');
  });
});

describe('Ciclo 6b — N-06: placeholder de candidato reprovado não carrega proveniência de dado real', () => {
  const l1Rejected: Layer1Output = {
    symbol: 'AAPL',
    sector: 'Technology',
    hv12m: { value: 35, provenance: 'DERIVADO', source: 'gk' },
    hv12mTrimmed: { value: 32, provenance: 'DERIVADO', source: 'gk' },
    hvDropRatio: { value: 0.08, provenance: 'DERIVADO', source: 'd' },
    hv12mPercentile: { value: 75, provenance: 'DERIVADO', source: 'p' },
    passesHvPercentile: true,
    passesStability: true,
    sectorQuotaApproved: true,
    bbwCurrent: { value: 9, provenance: 'DERIVADO', source: 'b' },
    bbwHistoryPercentile: { value: 60, provenance: 'DERIVADO', source: 'b' },
    passesSqueeze: false, // reprovado na camada 1
  };

  it('N-06: candidato reprovado antes da camada 2 => atmIv/ivRank/ivPercentile INDISPONIVEL', () => {
    const [res] = processLayer2([l1Rejected], new Map());
    for (const f of [res.atmIv, res.ivRank, res.ivPercentile]) {
      expect(f.provenance).toBe('INDISPONIVEL');
      expect(f.source).not.toContain('tastytrade-live');
    }
  });

  it('N-06: ramo "histórico de IV ausente" não assume fonte e usa a mesma escala (0-100) da IV', () => {
    const exp = [{ expirationDate: '2026-10-23', daysToExpiration: 37, expirationType: 'Standard' }];
    const l1Ok = { ...l1Rejected, passesSqueeze: true };
    const semFonte = processLayer2(
      [l1Ok],
      new Map([['AAPL', { rawIvr: null, rawIvp: 0.2, atmIv: 0.25, expirations: exp }]]) as any
    )[0];
    expect(semFonte.atmIv.provenance).toBe('INDISPONIVEL');
    const comFonte = processLayer2(
      [l1Ok],
      new Map([['AAPL', { rawIvr: null, rawIvp: 0.2, atmIv: 0.25, expirations: exp, source: 'fonte-teste' }]]) as any
    )[0];
    expect(comFonte.atmIv.provenance).toBe('MEDIDO');
    expect(comFonte.atmIv.value).toBe(25);
    expect(comFonte.atmIv.source).toBe('fonte-teste');
  });
});
