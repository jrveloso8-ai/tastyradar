import WebSocket from 'ws';
import { tastyAuthService } from './tastytrade-auth.service';

/**
 * Cliente DXLink real (WebSocket de streaming) para gregas, IV e Open Interest ao vivo.
 *
 * Por que existe: confirmado contra a documentação oficial da Tastytrade
 * (https://developer.tastytrade.com/openapi/market-data.json) que o endpoint REST
 * GET /market-data/by-type NÃO retorna delta/gamma/volatility — só preço (bid/ask/mid).
 * Grego e IV por contrato só existem via streaming DXLink. Sem isso, qualquer "delta"
 * ou "IV por strike" exibido seria calculado por modelo (BSM) e apresentado como se
 * fosse dado de mercado — exatamente o tipo de fabricação que motivou a rodada de
 * correção de 2026-09-08 (achado BAC: strike/DTE fabricados; ver PLANO_MESTRE_REMEDIACAO_RADAR.md).
 *
 * Implementação portada e adaptada, com o mesmo protocolo, do dashboard Python
 * comprovadamente funcional em C:\projetos phyton\01_Tastytrade-API-GEX-Dashboard-master
 * (utils/auth.py + simple_dashboard.py) — README desse projeto: "SPX and SPY confirmed
 * working". Mesma sequência DXLink: SETUP -> AUTH -> CHANNEL_REQUEST(FEED) ->
 * FEED_SUBSCRIPTION -> FEED_DATA, mesmo token (`getStreamerToken()`, já implementado
 * em tastytrade-auth.service.ts).
 *
 * Contrato de honestidade: se a conexão falhar, a autenticação falhar, ou um símbolo
 * não responder dentro da janela de espera, esse símbolo simplesmente NÃO aparece no
 * Map retornado. Nunca preenche com um valor default nem com um cálculo local — quem
 * chama decide como sinalizar "sem grego real disponível".
 */

export interface RealGreeksQuote {
  symbol: string; // streamer-symbol dxfeed, ex: ".BAC260911C45"
  delta: number | null;
  gamma: number | null;
  iv: number | null; // campo "volatility" do evento Greeks (IV implícita real do contrato)
  openInterest: number | null; // evento Summary
  lastPrice: number | null; // evento Trade
}

interface DxLinkMessage {
  type?: string;
  channel?: number;
  state?: string;
  data?: unknown[];
  [key: string]: unknown;
}

function parseMessage(raw: WebSocket.RawData): DxLinkMessage | null {
  try {
    return JSON.parse(raw.toString());
  } catch {
    return null;
  }
}

/**
 * Busca gregas/IV/OI reais via streaming DXLink para uma lista de streamer-symbols.
 * `waitMs` é quanto tempo a conexão fica aberta coletando eventos FEED_DATA antes de
 * fechar — 12s por padrão, o mesmo patamar usado no dashboard de referência (15-20s
 * para uma cadeia inteira; aqui normalmente são só as pernas eleitas, poucos símbolos).
 */
export async function fetchRealGreeks(
  streamerSymbols: string[],
  waitMs = 12000
): Promise<Map<string, RealGreeksQuote>> {
  const result = new Map<string, RealGreeksQuote>();
  if (streamerSymbols.length === 0) return result;

  let token: string;
  let dxlinkUrl: string;
  try {
    const streamer = await tastyAuthService.getStreamerToken();
    token = streamer.token;
    dxlinkUrl = streamer.dxlinkUrl;
  } catch (err: any) {
    console.warn(`[DXLink] Falha ao obter streamer token: ${err.message}`);
    return result; // vazio — chamador trata como "sem dado real disponível"
  }

  let ws: WebSocket;
  try {
    ws = new WebSocket(dxlinkUrl);
  } catch (err: any) {
    console.warn(`[DXLink] Falha ao instanciar WebSocket: ${err.message}`);
    return result;
  }

  const send = (obj: unknown) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
  };

  try {
    // 1) Conectar
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('timeout ao conectar')), 10000);
      ws.once('open', () => { clearTimeout(t); resolve(); });
      ws.once('error', (err) => { clearTimeout(t); reject(err); });
    });

    // 2) SETUP + AUTH
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('timeout na autenticação DXLink')), 10000);
      const onMessage = (raw: WebSocket.RawData) => {
        const msg = parseMessage(raw);
        if (!msg) return;
        if (msg.type === 'AUTH_STATE') {
          if (msg.state === 'UNAUTHORIZED') {
            send({ type: 'AUTH', channel: 0, token });
          } else if (msg.state === 'AUTHORIZED') {
            clearTimeout(t);
            ws.off('message', onMessage);
            resolve();
          }
        }
      };
      ws.on('message', onMessage);
      send({
        type: 'SETUP',
        channel: 0,
        keepaliveTimeout: 60,
        acceptKeepaliveTimeout: 60,
        version: '0.1-DXF-JS/0.3.0',
      });
    });

    // 3) Abrir canal FEED
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('timeout ao abrir canal FEED')), 10000);
      const onMessage = (raw: WebSocket.RawData) => {
        const msg = parseMessage(raw);
        if (!msg) return;
        if (msg.channel === 1) {
          clearTimeout(t);
          ws.off('message', onMessage);
          resolve();
        }
      };
      ws.on('message', onMessage);
      send({ type: 'CHANNEL_REQUEST', channel: 1, service: 'FEED', parameters: { contract: 'AUTO' } });
    });

    // 4) Assinar Greeks + Summary (OI) + Trade (último preço) para cada símbolo
    const subscriptions = streamerSymbols.flatMap((symbol) => [
      { symbol, type: 'Greeks' },
      { symbol, type: 'Summary' },
      { symbol, type: 'Trade' },
    ]);
    send({ type: 'FEED_SUBSCRIPTION', channel: 1, add: subscriptions });

    // 5) Coletar por `waitMs`
    await new Promise<void>((resolve) => {
      const onMessage = (raw: WebSocket.RawData) => {
        const msg = parseMessage(raw);
        if (!msg || msg.type !== 'FEED_DATA') return;
        const items = Array.isArray(msg.data) ? (msg.data as any[]) : [];
        for (const item of items) {
          const symbol = item?.eventSymbol;
          if (!symbol || typeof symbol !== 'string') continue;
          const existing: RealGreeksQuote = result.get(symbol) || {
            symbol,
            delta: null,
            gamma: null,
            iv: null,
            openInterest: null,
            lastPrice: null,
          };
          if (item.eventType === 'Greeks') {
            if (typeof item.delta === 'number') existing.delta = item.delta;
            if (typeof item.gamma === 'number') existing.gamma = item.gamma;
            if (typeof item.volatility === 'number') existing.iv = item.volatility;
          } else if (item.eventType === 'Summary') {
            if (typeof item.openInterest === 'number') existing.openInterest = item.openInterest;
          } else if (item.eventType === 'Trade') {
            if (typeof item.price === 'number') existing.lastPrice = item.price;
          }
          result.set(symbol, existing);
        }
      };
      ws.on('message', onMessage);
      setTimeout(() => {
        ws.off('message', onMessage);
        resolve();
      }, waitMs);
    });
  } catch (err: any) {
    console.warn(`[DXLink] Falha durante a sessão de streaming: ${err.message}`);
    // Retorna o que já tiver coletado até aqui (pode ser parcial ou vazio) — nunca fabrica o resto.
  } finally {
    try { ws.close(); } catch { /* noop */ }
  }

  return result;
}
