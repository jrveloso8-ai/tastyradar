import { tastyAuthService } from './tastytrade-auth.service';

export interface TastyLiveMetrics {
  symbol: string;
  ivRank: number;
  ivPercentile: number;
  iv30: number;
  tosIvIndex?: number;
  liquidityRating: number;
  beta: number;
  dividendYield: number;
  earningsDate?: string;
  daysToEarnings?: number;
  hv30?: number;
  hv60?: number;
  hv90?: number;
  updatedAt: string;
  source: 'tastytrade-live' | 'preset-fallback';
}

/**
 * Cadeia de opções real via GET /option-chains/{symbol}/nested (Tastytrade Instruments
 * API — https://developer.tastytrade.com/reference/instruments/). Frente 1 da rodada
 * "só dado real" decidida com o usuário em 2026-09-08, motivada pelo achado do BAC:
 * strikes/vencimentos fabricados por fórmula (`step = spot > 100 ? 5 : 2.5`) não batiam
 * com a grade real (ex.: BAC negociava em $1 perto do dinheiro, vencimento real de 38
 * DTE contra os 35 DTE fixos do motor). Nada aqui é sintetizado: se a API não responder
 * ou vier em formato inesperado, o método retorna null — o chamador decide como sinalizar
 * "sem dado real disponível", nunca preenche com valor calculado localmente.
 */
export interface OptionChainStrike {
  strike: number;
  callSymbol: string;
  putSymbol: string;
  callStreamerSymbol: string;
  putStreamerSymbol: string;
}

export interface OptionChainExpiration {
  expirationDate: string;
  daysToExpiration: number;
  expirationType: string;
  settlementType: string;
  strikes: OptionChainStrike[];
}

export interface OptionChainResult {
  symbol: string;
  expirations: OptionChainExpiration[];
  source: 'tastytrade-live';
  fetchedAt: string;
}

function parsePct(val: any, fallback = 0): number {
  if (val === undefined || val === null || val === '') return fallback;
  const num = typeof val === 'number' ? val : parseFloat(val);
  if (isNaN(num)) return fallback;
  if (num > 0 && num <= 1.0) {
    return Number((num * 100).toFixed(1));
  }
  return Number(num.toFixed(1));
}

export class TastytradeMarketService {
  private baseUrl: string;
  private metricsCache = new Map<string, { metrics: TastyLiveMetrics; expiresAt: number }>();
  private chainCache = new Map<string, { chain: OptionChainResult; expiresAt: number }>();

  private setCache(sym: string, metrics: TastyLiveMetrics, expiresAt: number) {
    // Evicção ativa contra memory leak em servidores persistentes (Achado A-19)
    if (this.metricsCache.size >= 100) {
      const now = Date.now();
      for (const [key, entry] of this.metricsCache.entries()) {
        if (entry.expiresAt <= now) {
          this.metricsCache.delete(key);
        }
      }
      if (this.metricsCache.size >= 100) {
        const oldestKey = this.metricsCache.keys().next().value;
        if (oldestKey) this.metricsCache.delete(oldestKey);
      }
    }
    this.metricsCache.set(sym, { metrics, expiresAt });
  }

  constructor() {
    this.baseUrl = process.env.TASTYTRADE_ENV === 'cert' 
      ? 'https://api.cert.tastyworks.com' 
      : 'https://api.tastytrade.com';
  }

  /**
   * Consulta métricas oficiais de volatilidade e liquidez diretamente da Tastytrade API.
   * Elimina discrepâncias entre a plataforma desktop e o sistema para qualquer ticker.
   */
  public async getMarketMetrics(symbols: string[], bypassCache = false): Promise<Record<string, TastyLiveMetrics>> {
    const cleanSymbols = Array.from(new Set(symbols.map(s => s.trim().toUpperCase()))).filter(Boolean);
    if (cleanSymbols.length === 0) return {};

    const result: Record<string, TastyLiveMetrics> = {};
    const missingFromCache: string[] = [];
    const now = Date.now();

    if (!bypassCache) {
      for (const sym of cleanSymbols) {
        const cached = this.metricsCache.get(sym);
        if (cached && cached.expiresAt > now) {
          result[sym] = cached.metrics;
        } else {
          missingFromCache.push(sym);
        }
      }
    } else {
      missingFromCache.push(...cleanSymbols);
    }

    if (missingFromCache.length === 0) {
      return result;
    }

    try {
      const token = await tastyAuthService.getAccessToken();
      const url = `${this.baseUrl}/market-metrics?symbols=${missingFromCache.join(',')}`;

      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'User-Agent': 'RadarTastytrade/1.0',
        },
      });

      if (res.ok) {
        const body = await res.json();
        const items = body.data?.items || [];

        for (const item of items) {
          const sym = (item.symbol || '').toUpperCase();
          if (!sym) continue;

          // IV Rank oficial Tastytrade: tw-implied-volatility-index-rank ou implied-volatility-index-rank
          const rawIvr = item['implied-volatility-index-rank'] ?? item['tw-implied-volatility-index-rank'] ?? 0;
          const rawIvp = item['implied-volatility-percentile'] ?? item['tw-implied-volatility-percentile'] ?? 0;
          const rawIv30 = item['implied-volatility-30-day'] ?? item['implied-volatility-index'] ?? 0;
          const rawTosIv = item['tos-implied-volatility-index-rank'];

          const earningsDate = item.earnings?.['expected-report-date'] || undefined;
          let daysToEarnings: number | undefined = undefined;
          if (earningsDate) {
            const diffMs = new Date(earningsDate).getTime() - now;
            daysToEarnings = Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
          }

          const metrics: TastyLiveMetrics = {
            symbol: sym,
            ivRank: parsePct(rawIvr),
            ivPercentile: parsePct(rawIvp),
            iv30: parsePct(rawIv30),
            tosIvIndex: rawTosIv !== undefined ? parsePct(rawTosIv) : undefined,
            liquidityRating: typeof item['liquidity-rating'] === 'number' ? item['liquidity-rating'] : 4,
            beta: parseFloat(item.beta || '1.0') || 1.0,
            dividendYield: parsePct(item['dividend-yield'] || 0),
            earningsDate,
            daysToEarnings,
            hv30: parsePct(item['historical-volatility-30-day']),
            hv60: parsePct(item['historical-volatility-60-day']),
            hv90: parsePct(item['historical-volatility-90-day']),
            updatedAt: item['updated-at'] || new Date().toISOString(),
            source: 'tastytrade-live',
          };

          result[sym] = metrics;
          this.setCache(sym, metrics, now + 60_000); // 60s cache com evicção ativa
        }
      }
    } catch (err: any) {
      console.warn(`[TastytradeMarketService] Falha ao consultar live market-metrics: ${err.message}`);
    }

    // Registra falha e não injeta métricas inventadas (REGRA 00)
    for (const sym of missingFromCache) {
      if (!result[sym]) {
        console.warn(`[TastytradeMarketService] Métrica ao vivo indisponível na corretora para ${sym}.`);
      }
    }

    return result;
  }

  /**
   * Busca a cadeia de opções REAL de um ativo (strikes, vencimentos, símbolos de
   * streamer) via GET /option-chains/{symbol}/nested. Cache de 5 min — estrutura de
   * strikes/vencimentos muda pouco intradia, diferente de greeks/OI (que virão de
   * market-data por streamer symbol, numa próxima etapa). Retorna null em qualquer
   * falha (rede, HTTP não-2xx, formato de resposta inesperado) — nunca inventa strike
   * ou vencimento como fallback (REGRA 00).
   */
  public async getOptionChain(symbol: string, bypassCache = false): Promise<OptionChainResult | null> {
    const sym = symbol.trim().toUpperCase();
    if (!sym) return null;
    const now = Date.now();

    if (!bypassCache) {
      const cached = this.chainCache.get(sym);
      if (cached && cached.expiresAt > now) return cached.chain;
    }

    try {
      const token = await tastyAuthService.getAccessToken();
      const url = `${this.baseUrl}/option-chains/${sym}/nested`;

      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'User-Agent': 'RadarTastytrade/1.0',
        },
      });

      if (!res.ok) {
        console.warn(`[TastytradeMarketService] Cadeia de opções indisponível para ${sym}: HTTP ${res.status}`);
        return null;
      }

      const body = await res.json();
      // Endpoints de recurso único costumam devolver o objeto direto em `data`; alguns
      // endpoints da Tastytrade envelopam em `data.items[0]`. Aceita os dois formatos
      // em vez de travar numa suposição só.
      const underlying = Array.isArray(body?.data?.items) ? body.data.items[0] : body?.data;

      if (!underlying || !Array.isArray(underlying.expirations)) {
        console.warn(`[TastytradeMarketService] Resposta de cadeia de opções sem "expirations" para ${sym} — formato inesperado, não fabrico dado.`);
        return null;
      }

      const expirations: OptionChainExpiration[] = underlying.expirations
        .map((exp: any) => ({
          expirationDate: exp['expiration-date'],
          daysToExpiration: Number(exp['days-to-expiration']) || 0,
          expirationType: exp['expiration-type'] || 'Regular',
          settlementType: exp['settlement-type'] || 'PM',
          strikes: (exp.strikes || [])
            .map((s: any) => ({
              strike: parseFloat(s['strike-price']),
              callSymbol: s['call'] || '',
              putSymbol: s['put'] || '',
              callStreamerSymbol: s['call-streamer-symbol'] || '',
              putStreamerSymbol: s['put-streamer-symbol'] || '',
            }))
            .filter((s: OptionChainStrike) => !isNaN(s.strike) && s.strike > 0),
        }))
        .filter((e: OptionChainExpiration) => e.strikes.length > 0);

      if (expirations.length === 0) {
        console.warn(`[TastytradeMarketService] Cadeia de opções vazia para ${sym} após parsing — não fabrico dado.`);
        return null;
      }

      const chain: OptionChainResult = {
        symbol: sym,
        expirations,
        source: 'tastytrade-live',
        fetchedAt: new Date().toISOString(),
      };

      if (this.chainCache.size >= 50) {
        for (const [key, entry] of this.chainCache.entries()) {
          if (entry.expiresAt <= now) this.chainCache.delete(key);
        }
        if (this.chainCache.size >= 50) {
          const oldestKey = this.chainCache.keys().next().value;
          if (oldestKey) this.chainCache.delete(oldestKey);
        }
      }
      this.chainCache.set(sym, { chain, expiresAt: now + 300_000 });

      return chain;
    } catch (err: any) {
      console.warn(`[TastytradeMarketService] Falha ao consultar cadeia de opções real para ${sym}: ${err.message}`);
      return null;
    }
  }

  /**
   * Cotação real (bid/ask/mid) por contrato de opção via GET /market-data/by-type
   * (Tastytrade Market Data API). Confirmado contra a doc oficial: aceita símbolos em
   * OCC symbology (o mesmo formato de `callSymbol`/`putSymbol` retornado por
   * getOptionChain()), separados por vírgula, e responde com "symbol" batendo o que
   * foi pedido. NÃO retorna gregas/IV — isso só existe via streaming DXLink
   * (ver tastytrade-dxlink.service.ts). Símbolo que não vier na resposta fica ausente
   * do Map — nunca preenchido com preço BSM ou qualquer valor calculado localmente.
   */
  public async getOptionQuotes(occSymbols: string[]): Promise<Map<string, { bid: number | null; ask: number | null; mid: number | null }>> {
    const result = new Map<string, { bid: number | null; ask: number | null; mid: number | null }>();
    const symbols = occSymbols.map((s) => s.trim()).filter(Boolean);
    if (symbols.length === 0) return result;

    try {
      const token = await tastyAuthService.getAccessToken();
      const query = encodeURIComponent(symbols.join(','));
      const url = `${this.baseUrl}/market-data/by-type?equity-option=${query}`;
      const res = await fetch(url, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json', 'User-Agent': 'RadarTastytrade/1.0' },
      });
      if (!res.ok) {
        console.warn(`[TastytradeMarketService] Cotação de opções indisponível: HTTP ${res.status}`);
        return result;
      }
      const body = await res.json();
      const items = Array.isArray(body?.data?.items) ? body.data.items : [];
      for (const item of items) {
        const symbol = item?.symbol;
        if (!symbol || typeof symbol !== 'string') continue;
        const bid = item.bid != null ? parseFloat(item.bid) : null;
        const ask = item.ask != null ? parseFloat(item.ask) : null;
        const midRaw = item.mid != null ? parseFloat(item.mid) : null;
        const mid = midRaw != null && !isNaN(midRaw)
          ? midRaw
          : (bid != null && ask != null && !isNaN(bid) && !isNaN(ask) ? Number(((bid + ask) / 2).toFixed(4)) : null);
        result.set(symbol, {
          bid: bid != null && !isNaN(bid) ? bid : null,
          ask: ask != null && !isNaN(ask) ? ask : null,
          mid,
        });
      }
    } catch (err: any) {
      console.warn(`[TastytradeMarketService] Falha ao consultar cotação real de opções: ${err.message}`);
    }
    return result;
  }

  // getQuote() e getGexAnalysis() foram removidos nesta sessão (Nível 1, Parte 1):
  // eram código morto (nenhuma rota/componente os chamava — confirmado por grep antes
  // da remoção), continham um dicionário fixo de 9 tickers com fallback de US$ 100,00
  // (uma terceira fonte de spot divergente de US_STOCKS_DATASET/SP500_DATASET) e uma
  // cadeia de opções sintética própria (Achados D-04/D-05 do laudo Ciclo 4). Se um
  // método de cotação/GEX real for reintroduzido aqui, deve consumir a fonte única
  // de spot definida no domínio, nunca um preset novo.
}

export const tastyMarketService = new TastytradeMarketService();