import { tastyAuthService } from './tastytrade-auth.service';

export interface TastyLiveMetrics {
  symbol: string;
  ivRank: number | null;
  ivPercentile: number | null;
  iv30: number | null;
  tosIvIndex?: number | null;
  liquidityRating: number;
  beta: number | null;
  dividendYield: number | null;
  earningsDate?: string;
  daysToEarnings?: number;
  hv30?: number | null;
  hv60?: number | null;
  hv90?: number | null;
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

function parsePct(val: any): number | null {
  if (val === undefined || val === null || val === '') return null;
  const num = typeof val === 'number' ? val : parseFloat(val);
  if (isNaN(num)) return null;
  if (num > 0 && num <= 1.0) {
    return Number((num * 100).toFixed(1));
  }
  return Number(num.toFixed(1));
}

export interface TastyEquityQuote {
  symbol: string;
  last: number | null;
  bid: number | null;
  ask: number | null;
  mid: number | null;
  open: number | null;
  prevClose: number | null;
  change: number | null;
  changePct: number | null;
  extendedPrice?: number | null;
  extendedChangePct?: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  volume: number | null;
  updatedAt: string;
  source: 'tastytrade-live';
}

export class TastytradeMarketService {
  private baseUrl: string;
  private metricsCache = new Map<string, { metrics: TastyLiveMetrics; expiresAt: number }>();
  private chainCache = new Map<string, { chain: OptionChainResult; expiresAt: number }>();
  private equityQuotesCache = new Map<string, { quote: TastyEquityQuote; expiresAt: number }>();

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

          // IV Rank oficial Tastytrade (52 semanas / 252 dias úteis, padrão da Watchlist oficial da corretora):
          // Prioridade para implied-volatility-index-rank / tos-implied-volatility-index-rank
          const raw52wIvr = item['implied-volatility-index-rank'] ?? item['tos-implied-volatility-index-rank'];
          const rawTwIvr = item['tw-implied-volatility-index-rank'];
          const rawIvr = raw52wIvr ?? rawTwIvr;

          const rawIvp = item['implied-volatility-percentile'] ?? item['tw-implied-volatility-percentile'];
          const rawIv30 = item['implied-volatility-30-day'] ?? item['implied-volatility-index'];
          const rawTosIv = raw52wIvr;

          const earningsDate = item.earnings?.['expected-report-date'] || undefined;
          let daysToEarnings: number | undefined = undefined;
          if (earningsDate) {
            const diffMs = new Date(earningsDate).getTime() - now;
            daysToEarnings = Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
          }

          const rawBeta = item.beta !== undefined && item.beta !== null && item.beta !== '' ? parseFloat(item.beta) : null;
          const beta = rawBeta !== null && !isNaN(rawBeta) ? Number(rawBeta.toFixed(2)) : null;

          const metrics: TastyLiveMetrics = {
            symbol: sym,
            ivRank: parsePct(rawIvr),
            ivPercentile: parsePct(rawIvp),
            iv30: parsePct(rawIv30),
            tosIvIndex: rawTosIv !== undefined ? parsePct(rawTosIv) : undefined,
            liquidityRating: typeof item['liquidity-rating'] === 'number' ? item['liquidity-rating'] : 4,
            beta,
            dividendYield: parsePct(item['dividend-yield']),
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
          daysToExpiration: (() => {
            const rawDte = exp['days-to-expiration'];
            if (typeof rawDte === 'number') return rawDte;
            const parsed = parseInt(String(rawDte), 10);
            if (!isNaN(parsed)) return parsed;
            if (exp['expiration-date']) {
              const [y, m, d] = String(exp['expiration-date']).split('-').map(Number);
              const target = new Date(y, m - 1, d);
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              return Math.max(0, Math.ceil((target.getTime() - today.getTime()) / 86400000));
            }
            return 0;
          })(),
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

  /**
   * Consulta cotações de ações/ETFs (spot real) diretamente na Tastytrade Market Data API:
   * GET /market-data/by-type?equity=SYMBOL1,SYMBOL2,...
   * Suporta até 100 símbolos por requisição (especificação oficial Tastytrade).
   * Lotes > 100 são automaticamente particionados em requisições paralelas.
   * Cache de 15 segundos com evicção ativa.
   * REGRA 00: Tickers indisponíveis ou em falha simplesmente não constam no Record
   * de saída — nunca se inventa spot de fallback.
   */
  public async getEquityQuotes(symbols: string[], bypassCache = false): Promise<Record<string, TastyEquityQuote>> {
    const cleanSymbols = Array.from(new Set(symbols.map(s => s.trim().toUpperCase()))).filter(Boolean);
    if (cleanSymbols.length === 0) return {};

    const result: Record<string, TastyEquityQuote> = {};
    const missingFromCache: string[] = [];
    const now = Date.now();

    if (!bypassCache) {
      for (const sym of cleanSymbols) {
        const cached = this.equityQuotesCache.get(sym);
        if (cached && cached.expiresAt > now) {
          result[sym] = cached.quote;
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

    // Particiona em lotes de no máximo 100 símbolos
    const chunkSize = 100;
    const chunks: string[][] = [];
    for (let i = 0; i < missingFromCache.length; i += chunkSize) {
      chunks.push(missingFromCache.slice(i, i + chunkSize));
    }

    try {
      const token = await tastyAuthService.getAccessToken();

      await Promise.all(
        chunks.map(async (chunk) => {
          const query = encodeURIComponent(chunk.join(','));
          const url = `${this.baseUrl}/market-data/by-type?equity=${query}`;

          const res = await fetch(url, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/json',
              'User-Agent': 'RadarTastytrade/1.0',
            },
          });

          if (!res.ok) {
            console.warn(`[TastytradeMarketService] Falha ao consultar equity quotes (lote de ${chunk.length}): HTTP ${res.status}`);
            return;
          }

          const body = await res.json();
          const items = Array.isArray(body?.data?.items) ? body.data.items : [];

          for (const item of items) {
            const sym = (item.symbol || '').toUpperCase().trim();
            if (!sym) continue;

            const parseNum = (v: any): number | null => {
              if (v === undefined || v === null || v === '') return null;
              const n = typeof v === 'number' ? v : parseFloat(v);
              return isNaN(n) ? null : n;
            };

            // No mercado americano:
            // - lastMkt ('last-mkt'): último fechamento do PREGÃO REGULAR oficial (RTH). É o valor que a Tastytrade
            //   exibe na coluna Last e usa para calcular a variação oficial da sessão (Chg / Chg%).
            // - rawLast ('last' / 'mark'): último negócio registrado, que durante Pre-Market ou After-Hours (ETH)
            //   reflete as negociações estendidas.
            const rawLastMkt = parseNum(item['last-mkt']);
            const rawLast = parseNum(item.last ?? item.mark);
            const last = rawLastMkt !== null ? rawLastMkt : rawLast;

            const bid = parseNum(item.bid);
            const ask = parseNum(item.ask);
            const midRaw = parseNum(item.mid);
            const mid = midRaw !== null
              ? midRaw
              : (bid !== null && ask !== null ? Number(((bid + ask) / 2).toFixed(4)) : last);

            const prevClose = parseNum(item['prev-close']);
            const open = parseNum(item.open);
            const dayHigh = parseNum(item['day-high-price']);
            const dayLow = parseNum(item['day-low-price']);
            const volume = parseNum(item.volume);

            let change: number | null = null;
            let changePct: number | null = null;
            if (last !== null && prevClose !== null && prevClose > 0) {
              change = Number((last - prevClose).toFixed(4));
              changePct = Number((((last - prevClose) / prevClose) * 100).toFixed(2));
            }

            // Extended hours (pre-market / after-hours) quando o preço estendido difere do pregão regular
            let extendedPrice: number | null = null;
            let extendedChangePct: number | null = null;
            if (rawLast !== null && rawLastMkt !== null && Math.abs(rawLast - rawLastMkt) > 0.001) {
              extendedPrice = rawLast;
              if (prevClose !== null && prevClose > 0) {
                extendedChangePct = Number((((rawLast - prevClose) / prevClose) * 100).toFixed(2));
              }
            }

            const quote: TastyEquityQuote = {
              symbol: sym,
              last,
              bid,
              ask,
              mid,
              open,
              prevClose,
              change,
              changePct,
              extendedPrice,
              extendedChangePct,
              dayHigh,
              dayLow,
              volume,
              updatedAt: item['updated-at'] || new Date().toISOString(),
              source: 'tastytrade-live',
            };

            result[sym] = quote;

            // Evicção ativa simples se cache atingir tamanho máximo
            if (this.equityQuotesCache.size >= 200) {
              const expireNow = Date.now();
              for (const [key, entry] of this.equityQuotesCache.entries()) {
                if (entry.expiresAt <= expireNow) this.equityQuotesCache.delete(key);
              }
              if (this.equityQuotesCache.size >= 200) {
                const oldestKey = this.equityQuotesCache.keys().next().value;
                if (oldestKey) this.equityQuotesCache.delete(oldestKey);
              }
            }
            this.equityQuotesCache.set(sym, { quote, expiresAt: now + 15_000 }); // 15s cache
          }
        })
      );
    } catch (err: any) {
      console.warn(`[TastytradeMarketService] Falha de rede ao consultar equity quotes: ${err.message}`);
    }

    return result;
  }
}

export const tastyMarketService = new TastytradeMarketService();