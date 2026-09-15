import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// C5-10 (laudo Ciclo 5): este teste fazia fetch() real contra a API da Tastytrade,
// dependendo de rede/credenciais disponiveis no ambiente que roda `vitest`. Isso o
// tornava nao-deterministico (falha quando nao ha rede, mesmo com o codigo correto) e
// fora do escopo do que um teste unitario deve validar. Mock de `fetch` e de
// `tastyAuthService.getAccessToken` isola o teste do transporte real: o que se testa
// aqui e o PARSING da resposta e a REGRA 00 (nunca fabricar metrica quando a fonte
// falha), nao a disponibilidade da API em si.
vi.mock('./tastytrade-auth.service', () => ({
  tastyAuthService: {
    getAccessToken: vi.fn().mockResolvedValue('fake-access-token-for-tests'),
  },
}));

import { tastyMarketService } from './tastytrade-market.service';
import { tastyAuthService } from './tastytrade-auth.service';

function mockFetchOnce(response: { ok: boolean; status?: number; json?: () => Promise<any> }) {
  return vi.fn().mockResolvedValue({
    ok: response.ok,
    status: response.status ?? (response.ok ? 200 : 500),
    json: response.json ?? (() => Promise.resolve({})),
  });
}

describe('TastytradeMarketService - Market Metrics', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('should retrieve metrics and parse the official Tastytrade market-metrics payload', async () => {
    const fakeApiResponse = {
      data: {
        items: [
          {
            symbol: 'SPY',
            'implied-volatility-index-rank': '0.42',
            'implied-volatility-percentile': '0.55',
            'implied-volatility-30-day': '0.18',
            'liquidity-rating': 4,
            beta: '1.02',
            'dividend-yield': '0.013',
            'historical-volatility-30-day': '0.16',
            'historical-volatility-60-day': '0.17',
            'historical-volatility-90-day': '0.19',
            'updated-at': '2026-09-10T12:00:00Z',
          },
          {
            symbol: 'F',
            'implied-volatility-index-rank': '0.61',
            'implied-volatility-percentile': '0.70',
            'implied-volatility-30-day': '0.35',
            'liquidity-rating': 3,
            beta: '1.45',
            'dividend-yield': '0.05',
            'updated-at': '2026-09-10T12:00:00Z',
          },
        ],
      },
    };
    vi.stubGlobal('fetch', mockFetchOnce({ ok: true, json: () => Promise.resolve(fakeApiResponse) }));

    const metrics = await tastyMarketService.getMarketMetrics(['SPY', 'F'], true);

    expect(tastyAuthService.getAccessToken).toHaveBeenCalled();
    expect(metrics.SPY).toBeDefined();
    expect(metrics.F).toBeDefined();
    expect(metrics.SPY.symbol).toBe('SPY');
    expect(metrics.F.symbol).toBe('F');
    expect(metrics.SPY.source).toBe('tastytrade-live');

    // Contrato de parsing: fracao decimal (0-1) vira percentual (0-100) via parsePct
    expect(metrics.SPY.ivRank).toBeCloseTo(42, 1);
    expect(metrics.SPY.iv30).toBeCloseTo(18, 1);
    expect(metrics.SPY.beta).toBe(1.02);
    expect(metrics.F.ivRank).toBeCloseTo(61, 1);
    expect(metrics.F.iv30).toBeCloseTo(35, 1);
  });

  it('should return empty object if no symbols provided', async () => {
    const metrics = await tastyMarketService.getMarketMetrics([]);
    expect(metrics).toEqual({});
    // Nao deve nem tentar autenticar/chamar rede para uma lista vazia.
    expect(tastyAuthService.getAccessToken).not.toHaveBeenCalled();
  });

  it('REGRA 00: quando a fonte falha (erro de rede), nunca fabrica metrica de fallback — o simbolo simplesmente fica ausente do resultado', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('fetch failed')));

    const metrics = await tastyMarketService.getMarketMetrics(['TSLA'], true);

    expect(metrics.TSLA).toBeUndefined();
    expect(metrics).toEqual({});
  });

  it('REGRA 00: quando a API responde HTTP nao-2xx, nunca fabrica metrica de fallback', async () => {
    vi.stubGlobal('fetch', mockFetchOnce({ ok: false, status: 503 }));

    const metrics = await tastyMarketService.getMarketMetrics(['NVDA'], true);

    expect(metrics.NVDA).toBeUndefined();
    expect(metrics).toEqual({});
  });

  it('deve priorizar tw-implied-volatility-index-rank (plataforma Tastytrade) sobre a fórmula legada TOS', async () => {
    const fakeApiResponse = {
      data: {
        items: [
          {
            symbol: 'NVDA',
            'implied-volatility-index-rank': '0.114',
            'tos-implied-volatility-index-rank': '0.114',
            'tw-implied-volatility-index-rank': '0.136',
            'implied-volatility-percentile': '0.08',
            'implied-volatility-30-day': '0.376',
            'liquidity-rating': 4,
            beta: '2.25',
            'updated-at': '2026-09-15T12:00:00Z',
          },
        ],
      },
    };
    vi.stubGlobal('fetch', mockFetchOnce({ ok: true, json: () => Promise.resolve(fakeApiResponse) }));

    const metrics = await tastyMarketService.getMarketMetrics(['NVDA'], true);

    expect(metrics.NVDA).toBeDefined();
    // Prioridade máxima para a plataforma Tastyworks/Tastytrade (13.6%):
    expect(metrics.NVDA.ivRank).toBe(13.6);
    // Fórmula legada TOS armazenada em campo auxiliar para auditoria:
    expect(metrics.NVDA.tosIvIndex).toBe(11.4);
    expect(metrics.NVDA.ivPercentile).toBe(8.0);
    expect(metrics.NVDA.iv30).toBe(37.6);
  });

  // getQuote()/getGexAnalysis() foram removidos do servico (Nivel 1, Parte 1 — eram
  // codigo morto com uma terceira fonte de spot divergente). O teste de GEX que existia
  // aqui cobria esse metodo removido; a cobertura de calculateGex() em si permanece em
  // gex-engine.test.ts, que e o motor de verdade e nao mudou.
});

describe('TastytradeMarketService - Equity Quotes (Spot Real)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('deve consultar e fazer parse exato do payload oficial /market-data/by-type?equity=...', async () => {
    const samplePayload = {
      data: {
        items: [
          {
            symbol: 'NVDA',
            last: '212.1',
            bid: '212.1',
            ask: '212.11',
            mid: '212.105',
            open: '211.24',
            'prev-close': '218.29',
            'day-high-price': '212.77',
            'day-low-price': '208.93',
            volume: '86606225.238593',
            'updated-at': '2026-09-14T18:32:08.041Z',
          },
          {
            symbol: 'AAPL',
            last: '334.32',
            bid: '334.29',
            ask: '334.35',
            mid: '334.32',
            open: '334.79',
            'prev-close': '332.27',
            'day-high-price': '335.5',
            'day-low-price': '331.34',
            volume: '23221042.003089',
            'updated-at': '2026-09-14T18:32:08.043Z',
          },
        ],
      },
    };

    vi.stubGlobal('fetch', mockFetchOnce({ ok: true, json: () => Promise.resolve(samplePayload) }));

    const quotes = await tastyMarketService.getEquityQuotes(['NVDA', 'AAPL'], true);

    expect(quotes.NVDA).toBeDefined();
    expect(quotes.AAPL).toBeDefined();

    // Verificacao numerica exata do NVDA (conforme print do usuario)
    expect(quotes.NVDA.symbol).toBe('NVDA');
    expect(quotes.NVDA.last).toBe(212.1);
    expect(quotes.NVDA.bid).toBe(212.1);
    expect(quotes.NVDA.ask).toBe(212.11);
    expect(quotes.NVDA.mid).toBe(212.105);
    expect(quotes.NVDA.prevClose).toBe(218.29);
    expect(quotes.NVDA.change).toBe(-6.19);
    expect(quotes.NVDA.changePct).toBe(-2.84);
    expect(quotes.NVDA.source).toBe('tastytrade-live');

    // Verificacao do AAPL
    expect(quotes.AAPL.symbol).toBe('AAPL');
    expect(quotes.AAPL.last).toBe(334.32);
    expect(quotes.AAPL.change).toBe(2.05);
    expect(quotes.AAPL.changePct).toBe(0.62);
  });

  it('deve retornar objeto vazio se nenhum simbolo for fornecido sem disparar requisicao', async () => {
    const quotes = await tastyMarketService.getEquityQuotes([]);
    expect(quotes).toEqual({});
    expect(tastyAuthService.getAccessToken).not.toHaveBeenCalled();
  });

  it('REGRA 00: quando a fonte falha por rede, nenhum spot e inventado', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    const quotes = await tastyMarketService.getEquityQuotes(['NVDA'], true);
    expect(quotes.NVDA).toBeUndefined();
    expect(quotes).toEqual({});
  });

  it('REGRA 00: quando a API responde com status nao-2xx, nenhum fallback e injetado', async () => {
    vi.stubGlobal('fetch', mockFetchOnce({ ok: false, status: 502 }));

    const quotes = await tastyMarketService.getEquityQuotes(['NVDA'], true);
    expect(quotes.NVDA).toBeUndefined();
    expect(quotes).toEqual({});
  });
});

