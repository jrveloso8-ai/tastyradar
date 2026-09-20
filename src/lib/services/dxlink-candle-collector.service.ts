/**
 * REGRA 00 — INTEGRIDADE DO DADO EXIBIDO
 * MÓDULO DEDICADO DE CAPTURA DE CANDLES HISTÓRICOS VIA DXLINK (WEBSOCKET)
 *
 * Exclusivamente para o Screener de Baixa Volatilidade (V1).
 * Não mantém streaming contínuo aberto: conecta pontualmente, autentica,
 * assina o evento Candle (${SYMBOL}{=d}) com fromTime >= 252 pregões (~370 dias corridos),
 * acumula o lote histórico, valida integridade física/completude e encerra a conexão.
 *
 * Invariantes de Integridade:
 * - Se a contagem de barras for < minBarsRequired (default 250): rejeita com CANDLE_STREAM_INCOMPLETE.
 * - Se a captura não concluir no timeout configurado: rejeita com CANDLE_STREAM_TIMEOUT.
 * - Se qualquer barra tiver high < low, NaN, ou preço <= 0: rejeita com INVALID_BAR_DATA.
 * - Proveniência: MEDIDO.
 * - Source padronizado único: tastytrade-dxlink-candles.
 * - NUNCA sintetiza dados, nunca interpola lacunas e nunca usa fallbacks artificiais.
 */

import WebSocket from 'ws';
import { tastyAuthService } from './tastytrade-auth.service';
import { OHLCVBar, ScreenerRejectionCode } from '../types/low-vol-screener.types';
import { ProvenanceBadge } from '../types/provenance';

/**
 * Identificador padronizado da fonte de candles via DXLink.
 * Alinhado 1:1 com barsSource em ScreenerCandidateInput e no Contrato de Proveniência.
 */
export const TASTYTRADE_DXLINK_CANDLE_SOURCE = 'tastytrade-dxlink-candles';

/**
 * 252 pregões úteis requerem aproximadamente 365 a 370 dias corridos
 * (52 semanas x 2 dias de fim de semana = 104 dias + ~9 a 10 feriados da NYSE/NASDAQ).
 * O buffer de 370 dias corridos garante margem determinística para capturar o lote histórico de 1 ano.
 */
export const CALENDAR_DAYS_BUFFER_FOR_252_TRADING_DAYS = 370;

export interface DxlinkRawCandleItem {
  eventType?: string;
  eventSymbol?: string;
  time?: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
  count?: number;
}

export interface CandleCollectionResult {
  symbol: string;
  bars: OHLCVBar[];
  provenance: ProvenanceBadge;
  source: string;
  isComplete: boolean;
  rejectionCode?: ScreenerRejectionCode;
  rejectionReason?: string;
}

export interface DxlinkCollectorOptions {
  timeoutMs?: number; // default: 15000ms
  minBarsRequired?: number; // default: 250 barras
  historyDays?: number; // default: 370 dias corridos retroativos
}

export const DEFAULT_COLLECTOR_OPTIONS: Required<DxlinkCollectorOptions> = {
  timeoutMs: 15000,
  minBarsRequired: 250,
  historyDays: CALENDAR_DAYS_BUFFER_FOR_252_TRADING_DAYS,
};

/**
 * Função Pura: Processa, deduplica, valida e ordena barras brutas de candles recebidas do DXLink.
 * Retorna resultado de coleta auditável por símbolo.
 */
export function processDxlinkCandleData(
  symbol: string,
  rawItems: DxlinkRawCandleItem[],
  options: { minBarsRequired?: number } = {}
): CandleCollectionResult {
  const minBars = options.minBarsRequired ?? DEFAULT_COLLECTOR_OPTIONS.minBarsRequired;
  const targetEventSymbol = `${symbol}{=d}`;

  const matchingItems = rawItems.filter(
    (item) => item.eventType === 'Candle' && item.eventSymbol === targetEventSymbol
  );

  const uniqueDateMap = new Map<string, OHLCVBar>();

  // 1. Consolida e deduplica itens brutos por data ISO (atualização mais recente vence)
  for (const item of matchingItems) {
    if (
      typeof item.time !== 'number' ||
      typeof item.open !== 'number' ||
      typeof item.high !== 'number' ||
      typeof item.low !== 'number' ||
      typeof item.close !== 'number'
    ) {
      continue;
    }

    const dateStr = new Date(item.time).toISOString().split('T')[0];
    let vol = 0;
    if (typeof item.volume === 'number' && !isNaN(item.volume)) {
      vol = item.volume;
    } else if (typeof item.count === 'number' && !isNaN(item.count)) {
      vol = item.count;
    }

    uniqueDateMap.set(dateStr, {
      date: dateStr,
      open: item.open,
      high: item.high,
      low: item.low,
      close: item.close,
      volume: vol,
    });
  }

  const sortedBars = Array.from(uniqueDateMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  // 2. Validação física estrita sobre a série consolidada definitiva
  for (const bar of sortedBars) {
    if (isNaN(bar.open) || isNaN(bar.high) || isNaN(bar.low) || isNaN(bar.close)) {
      return {
        symbol,
        bars: [],
        provenance: 'INDISPONIVEL',
        source: TASTYTRADE_DXLINK_CANDLE_SOURCE,
        isComplete: false,
        rejectionCode: 'INVALID_BAR_DATA',
        rejectionReason: `Barra com valor NaN detectada para o ativo ${symbol} na data ${bar.date}.`,
      };
    }

    if (bar.open <= 0 || bar.high <= 0 || bar.low <= 0 || bar.close <= 0) {
      return {
        symbol,
        bars: [],
        provenance: 'INDISPONIVEL',
        source: TASTYTRADE_DXLINK_CANDLE_SOURCE,
        isComplete: false,
        rejectionCode: 'INVALID_BAR_DATA',
        rejectionReason: `Preço não positivo detectado na barra (open: ${bar.open}, high: ${bar.high}, low: ${bar.low}, close: ${bar.close}) para ${symbol} na data ${bar.date}.`,
      };
    }

    if (bar.high < bar.low) {
      return {
        symbol,
        bars: [],
        provenance: 'INDISPONIVEL',
        source: TASTYTRADE_DXLINK_CANDLE_SOURCE,
        isComplete: false,
        rejectionCode: 'INVALID_BAR_DATA',
        rejectionReason: `Inconsistência física nos preços da barra (high: ${bar.high} < low: ${bar.low}) para ${symbol} na data ${bar.date}.`,
      };
    }
  }

  // 3. Validação de completude histórica
  if (sortedBars.length < minBars) {
    return {
      symbol,
      bars: sortedBars,
      provenance: 'INDISPONIVEL',
      source: TASTYTRADE_DXLINK_CANDLE_SOURCE,
      isComplete: false,
      rejectionCode: 'CANDLE_STREAM_INCOMPLETE',
      rejectionReason: `Captura de candles incompleta para ${symbol}: recebidas ${sortedBars.length} barras, mínimo exigido é ${minBars}.`,
    };
  }

  return {
    symbol,
    bars: sortedBars,
    provenance: 'MEDIDO',
    source: TASTYTRADE_DXLINK_CANDLE_SOURCE,
    isComplete: true,
  };
}

export class DxlinkCandleCollectorService {
  /**
   * Captura o lote histórico de candles diários via DXLink para uma lista de símbolos.
   * Conexão pontual: encerra o WebSocket assim que todos os dados são recebidos ou em caso de timeout.
   */
  public async collectDailyCandles(
    symbols: string[],
    options: DxlinkCollectorOptions = {}
  ): Promise<Map<string, CandleCollectionResult>> {
    const opts = { ...DEFAULT_COLLECTOR_OPTIONS, ...options };
    const resultMap = new Map<string, CandleCollectionResult>();
    const cleanSymbols = symbols.map((s) => s.trim().toUpperCase()).filter(Boolean);

    if (cleanSymbols.length === 0) {
      return resultMap;
    }

    // Inicializa resultados como pendentes
    for (const sym of cleanSymbols) {
      resultMap.set(sym, {
        symbol: sym,
        bars: [],
        provenance: 'INDISPONIVEL',
        source: TASTYTRADE_DXLINK_CANDLE_SOURCE,
        isComplete: false,
        rejectionCode: 'CANDLE_STREAM_INCOMPLETE',
        rejectionReason: 'Coleta não iniciada.',
      });
    }

    let streamerToken: { token: string; dxlinkUrl: string };
    try {
      const streamer = await tastyAuthService.getStreamerToken();
      streamerToken = { token: streamer.token, dxlinkUrl: streamer.dxlinkUrl };
    } catch (err: any) {
      for (const sym of cleanSymbols) {
        resultMap.set(sym, {
          symbol: sym,
          bars: [],
          provenance: 'INDISPONIVEL',
          source: TASTYTRADE_DXLINK_CANDLE_SOURCE,
          isComplete: false,
          rejectionCode: 'API_FAILURE',
          rejectionReason: `Falha de autenticação ao obter streamer token: ${err.message}`,
        });
      }
      return resultMap;
    }

    return new Promise((resolve) => {
      let isSettled = false;
      const accumulatedData: DxlinkRawCandleItem[] = [];
      let ws: WebSocket | null = null;

      const finishCollection = (timedOut = false) => {
        if (isSettled) return;
        isSettled = true;

        if (ws) {
          try {
            ws.removeAllListeners();
            ws.close();
          } catch (_e) {
            // socket já fechado ou erro ao fechar
          }
          ws = null;
        }

        for (const sym of cleanSymbols) {
          const res = processDxlinkCandleData(sym, accumulatedData, { minBarsRequired: opts.minBarsRequired });
          if (timedOut) {
            if (!res.isComplete) {
              // Só aplica CANDLE_STREAM_TIMEOUT quando a falha for por incompletude da série ou indefinida.
              // Se já houver uma causa raiz intrínseca aos dados (ex.: INVALID_BAR_DATA), preserva-a inalterada!
              if (!res.rejectionCode || res.rejectionCode === 'CANDLE_STREAM_INCOMPLETE') {
                resultMap.set(sym, {
                  symbol: sym,
                  bars: res.bars,
                  provenance: 'INDISPONIVEL',
                  source: TASTYTRADE_DXLINK_CANDLE_SOURCE,
                  isComplete: false,
                  rejectionCode: 'CANDLE_STREAM_TIMEOUT',
                  rejectionReason: `Timeout de ${opts.timeoutMs}ms atingido na conexão DXLink antes da recepção do lote completo.`,
                });
              } else {
                resultMap.set(sym, res);
              }
            } else {
              resultMap.set(sym, res);
            }
          } else {
            resultMap.set(sym, res);
          }
        }

        resolve(resultMap);
      };

      const timer = setTimeout(() => {
        finishCollection(true);
      }, opts.timeoutMs);

      try {
        ws = new WebSocket(streamerToken.dxlinkUrl);

        ws.on('open', () => {
          if (!ws) return;
          ws.send(
            JSON.stringify({
              type: 'SETUP',
              channel: 0,
              keepaliveInterval: 30,
              acceptKeepaliveInterval: 30,
              version: '0.1-GFE-1.0.0',
            })
          );
        });

        ws.on('message', (raw) => {
          if (!ws || isSettled) return;

          try {
            const msg = JSON.parse(raw.toString());

            if (msg.type === 'SETUP') {
              ws.send(JSON.stringify({ type: 'AUTH', channel: 0, token: streamerToken.token }));
            } else if (msg.type === 'AUTH_STATE' && msg.state === 'AUTHORIZED') {
              ws.send(
                JSON.stringify({
                  type: 'CHANNEL_REQUEST',
                  channel: 1,
                  service: 'FEED',
                  parameters: { contract: 'AUTO' },
                })
              );
            } else if (msg.type === 'CHANNEL_OPENED' && msg.channel === 1) {
              const fromTime = Date.now() - opts.historyDays * 24 * 60 * 60 * 1000;
              const subscriptions = cleanSymbols.map((s) => ({
                type: 'Candle',
                symbol: `${s}{=d}`,
                fromTime,
              }));

              ws.send(
                JSON.stringify({
                  type: 'FEED_SUBSCRIPTION',
                  channel: 1,
                  add: subscriptions,
                })
              );
            } else if (msg.type === 'FEED_DATA' && Array.isArray(msg.data)) {
              for (const item of msg.data) {
                accumulatedData.push(item);
              }

              // Verifica se todos os símbolos já atingiram a quantidade mínima de barras
              let allSymbolsComplete = true;
              for (const sym of cleanSymbols) {
                const check = processDxlinkCandleData(sym, accumulatedData, {
                  minBarsRequired: opts.minBarsRequired,
                });
                if (!check.isComplete) {
                  allSymbolsComplete = false;
                  break;
                }
              }

              if (allSymbolsComplete) {
                clearTimeout(timer);
                finishCollection(false);
              }
            }
          } catch (_err) {
            // ignora frame malformado
          }
        });

        ws.on('error', (_err) => {
          clearTimeout(timer);
          finishCollection(true);
        });

        ws.on('close', () => {
          if (!isSettled) {
            clearTimeout(timer);
            finishCollection(false);
          }
        });
      } catch (_err) {
        clearTimeout(timer);
        finishCollection(true);
      }
    });
  }
}

export const dxlinkCandleCollectorService = new DxlinkCandleCollectorService();
