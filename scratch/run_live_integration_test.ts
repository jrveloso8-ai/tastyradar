import fs from 'fs';
import path from 'path';
import WebSocket from 'ws';
import { tastyAuthService } from '../src/lib/services/tastytrade-auth.service';
import { tastyMarketService } from '../src/lib/services/tastytrade-market.service';
import { runScreenerV1Pipeline, CandidateMarketDataV1 } from '../src/lib/domain/screener-v1-orchestrator';
import { OHLCVBar, ScreenerCandidateInput } from '../src/lib/types/low-vol-screener.types';

// Tickers selecionados para o teste de integração
const TEST_TICKERS = [
  { symbol: 'AAPL', sector: 'Technology' },
  { symbol: 'NVDA', sector: 'Technology' },
  { symbol: 'XOM', sector: 'Energy' },
  { symbol: 'JNJ', sector: 'Healthcare' },
  { symbol: 'JPM', sector: 'Financials' },
  { symbol: 'TSLA', sector: 'Consumer Discretionary' },
];

interface RawCandleMsg {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  count: number;
}

/**
 * Coleta candles históricos diários reais via DXLink WebSocket.
 */
async function fetchRealCandlesMap(symbols: string[]): Promise<Map<string, OHLCVBar[]>> {
  const result = new Map<string, OHLCVBar[]>();
  for (const s of symbols) result.set(s, []);

  const streamer = await tastyAuthService.getStreamerToken();
  const ws = new WebSocket(streamer.dxlinkUrl);

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      console.log('[DXLink] Timeout de coleta atingido (15s). Fechando socket...');
      ws.close();
      resolve(result);
    }, 15000);

    ws.on('open', () => {
      ws.send(JSON.stringify({
        type: 'SETUP',
        channel: 0,
        keepaliveInterval: 30,
        acceptKeepaliveInterval: 30,
        version: '0.1-GFE-1.0.0',
      }));
    });

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'SETUP') {
          ws.send(JSON.stringify({ type: 'AUTH', channel: 0, token: streamer.token }));
        } else if (msg.type === 'AUTH_STATE' && msg.state === 'AUTHORIZED') {
          ws.send(JSON.stringify({ type: 'CHANNEL_REQUEST', channel: 1, service: 'FEED', parameters: { contract: 'AUTO' } }));
        } else if (msg.type === 'CHANNEL_OPENED' && msg.channel === 1) {
          const oneYearAgo = Date.now() - 370 * 24 * 60 * 60 * 1000;
          const subscriptions = symbols.map((s) => ({
            type: 'Candle',
            symbol: `${s}{=d}`,
            fromTime: oneYearAgo,
          }));
          ws.send(JSON.stringify({
            type: 'FEED_SUBSCRIPTION',
            channel: 1,
            add: subscriptions,
          }));
        } else if (msg.type === 'FEED_DATA' && Array.isArray(msg.data)) {
          for (const item of msg.data) {
            if (item.eventType === 'Candle' && item.eventSymbol && typeof item.open === 'number') {
              const sym = item.eventSymbol.replace('{=d}', '');
              const list = result.get(sym);
              if (list && !isNaN(item.open) && !isNaN(item.high) && !isNaN(item.low) && !isNaN(item.close)) {
                const dateStr = new Date(item.time).toISOString().split('T')[0];
                list.push({
                  date: dateStr,
                  open: item.open,
                  high: item.high,
                  low: item.low,
                  close: item.close,
                  volume: item.count || 100000,
                });
              }
            }
          }
        }
      } catch (e) {
        // ignora mensagens não-JSON
      }
    });

    ws.on('error', (err) => {
      console.error('[DXLink] Erro no WebSocket:', err);
      clearTimeout(timer);
      resolve(result);
    });
  });
}

async function main() {
  console.log('=== TESTE DE INTEGRAÇÃO CONTRA API REAL TASTYTRADE ===');
  const symbols = TEST_TICKERS.map(t => t.symbol);

  // 1. Consulta Market Metrics real
  console.log('1. Consultando GET /market-metrics...');
  const token = await tastyAuthService.getAccessToken();
  const metricsRes = await fetch(`https://api.tastytrade.com/market-metrics?symbols=${symbols.join(',')}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'User-Agent': 'RadarTastytrade/1.0',
    },
  });
  const metricsRaw = await metricsRes.json();
  fs.writeFileSync(
    path.join(process.cwd(), 'docs/fontes/market-metrics-live-run.sample.json'),
    JSON.stringify(metricsRaw, null, 2)
  );
  console.log('   Salvo docs/fontes/market-metrics-live-run.sample.json');

  // 2. Consulta Equity Quotes real (spot price)
  console.log('2. Consultando GET /market-data/by-type?equity=...');
  const spotQuotes = await tastyMarketService.getEquityQuotes(symbols);
  fs.writeFileSync(
    path.join(process.cwd(), 'docs/fontes/equity-quotes-live-run.sample.json'),
    JSON.stringify(spotQuotes, null, 2)
  );
  console.log('   Salvo docs/fontes/equity-quotes-live-run.sample.json');

  // 3. Coleta Candles Diários Reais
  console.log('3. Coletando Candles Históricos Reais (via DXLink Streamer oficial)...');
  const candlesMap = await fetchRealCandlesMap(symbols);
  const candlesSummary: Record<string, any> = {};
  for (const [sym, bars] of candlesMap.entries()) {
    // Remove duplicatas de timestamp mantendo ordenado por data
    const uniqueMap = new Map<string, OHLCVBar>();
    for (const b of bars) uniqueMap.set(b.date, b);
    const sortedBars = Array.from(uniqueMap.values()).sort((a, b) => a.date.localeCompare(b.date));
    candlesMap.set(sym, sortedBars);
    candlesSummary[sym] = {
      totalBars: sortedBars.length,
      firstDate: sortedBars[0]?.date,
      lastDate: sortedBars[sortedBars.length - 1]?.date,
      sampleFirstBar: sortedBars[0],
      sampleLastBar: sortedBars[sortedBars.length - 1],
    };
  }
  fs.writeFileSync(
    path.join(process.cwd(), 'docs/fontes/candles-live-run.sample.json'),
    JSON.stringify({ summary: candlesSummary, sampleAaplBars: candlesMap.get('AAPL')?.slice(-10) }, null, 2)
  );
  console.log('   Salvo docs/fontes/candles-live-run.sample.json');

  // 4. Consulta Option Chains reais para os tickers
  console.log('4. Consultando GET /option-chains/{symbol}/nested...');
  const chainsMap = new Map<string, any>();
  for (const sym of symbols) {
    const chain = await tastyMarketService.getOptionChain(sym);
    if (chain) chainsMap.set(sym, chain);
  }
  console.log(`   Cadeias de opções obtidas para ${chainsMap.size} tickers.`);

  // 5. Monta Candidatos e MarketDataMap
  const candidates: ScreenerCandidateInput[] = [];
  const marketDataMap = new Map<string, CandidateMarketDataV1>();

  const metricsItems = metricsRaw.data?.items || [];
  const metricsBySym = new Map<string, any>(metricsItems.map((item: any) => [item.symbol, item]));

  for (const ticker of TEST_TICKERS) {
    const sym = ticker.symbol;
    const bars = candlesMap.get(sym) || [];
    candidates.push({
      symbol: sym,
      sector: ticker.sector,
      bars,
      barsProvenance: bars.length >= 250 ? 'MEDIDO' : 'INDISPONIVEL',
      barsSource: 'tastytrade-dxlink-candles',
    });

    const spot = spotQuotes[sym]?.last || 0;
    const itemMetrics = metricsBySym.get(sym);
    const rawIvr = itemMetrics ? itemMetrics['tos-implied-volatility-index-rank'] ?? itemMetrics['implied-volatility-index-rank'] : null;
    const rawIvp = itemMetrics ? itemMetrics['implied-volatility-percentile'] : null;
    const atmIv = itemMetrics ? parseFloat(itemMetrics['implied-volatility-30-day'] || '0') / 100 : 0;

    const chain = chainsMap.get(sym);
    const expirations = chain ? chain.expirations.map((e: any) => ({
      expirationDate: e.expirationDate,
      daysToExpiration: e.daysToExpiration,
      expirationType: e.expirationType,
    })) : [];

    // Localiza strikes para a expiração candidata
    const strikes: any[] = [];
    if (chain && chain.expirations.length > 0) {
      // Pega a primeira expiração da grade
      const exp = chain.expirations.find((e: any) => e.daysToExpiration >= 30 && e.daysToExpiration <= 45) || chain.expirations[0];
      if (exp) {
        // Coleta 4 strikes ao redor do spot
        const sorted = [...exp.strikes].sort((a, b) => a.strike - b.strike);
        const nearStrikes = sorted.filter((s) => Math.abs(s.strike - spot) / spot < 0.10);
        const occSymbols = nearStrikes.flatMap((s) => [s.callSymbol, s.putSymbol]);
        const quotesMap = await tastyMarketService.getOptionQuotes(occSymbols);

        for (const s of nearStrikes) {
          const callQ = quotesMap.get(s.callSymbol);
          const putQ = quotesMap.get(s.putSymbol);
          strikes.push({
            strike: s.strike,
            callSymbol: s.callSymbol,
            putSymbol: s.putSymbol,
            callBid: callQ?.bid || 0,
            callAsk: callQ?.ask || 0,
            callOi: 500, // mock/streamer fallback para teste read-only
            putBid: putQ?.bid || 0,
            putAsk: putQ?.ask || 0,
            putOi: 500,
          });
        }
      }
    }

    marketDataMap.set(sym, {
      spotPrice: spot,
      chainStrikes: strikes,
      optionMetrics: {
        rawIvr: rawIvr != null ? parseFloat(rawIvr) : null,
        rawIvp: rawIvp != null ? parseFloat(rawIvp) : null,
        atmIv,
        expirations,
      },
    });
  }

  // 6. Executa o pipeline completo runScreenerV1Pipeline
  console.log('5. Executando runScreenerV1Pipeline com dados reais...');
  const results = runScreenerV1Pipeline(candidates, marketDataMap);

  fs.writeFileSync(
    path.join(process.cwd(), 'docs/fontes/pipeline-live-run-results.json'),
    JSON.stringify(results, null, 2)
  );
  console.log('   Salvo docs/fontes/pipeline-live-run-results.json');

  console.log('\n=== RESULTADO FINAL POR CANDIDATO ===');
  for (const r of results) {
    console.log(`\nTicker: ${r.candidate.symbol} (${r.candidate.sector})`);
    console.log(`- Status: ${r.status}`);
    if (r.status === 'REJECTED') {
      console.log(`- Estágio de Rejeição: ${r.rejectionStage}`);
      console.log(`- Código: ${r.layer0?.rejectionCode || r.layer1?.rejectionCode || r.layer2?.rejectionCode}`);
      console.log(`- Motivo: ${r.rejectionReason}`);
    } else {
      console.log(`- Estrutura Eleita: ${r.strategy?.structureType}`);
      console.log(`- Call Strike: ${r.strategy?.callLeg.strike} (Bid: ${r.strategy?.callLeg.bid}, Ask: ${r.strategy?.callLeg.ask})`);
      console.log(`- Put Strike: ${r.strategy?.putLeg.strike} (Bid: ${r.strategy?.putLeg.bid}, Ask: ${r.strategy?.putLeg.ask})`);
      console.log(`- Proveniência: ${r.strategy?.provenance}`);
    }
    console.log(`- L0 HV(12m): ${r.layer0.hv12m.value}% (Percentil: ${r.layer0.hv12mPercentile.value}%, Proveniência: ${r.layer0.hv12m.provenance})`);
    if (r.layer1) {
      console.log(`- L1 BBW Atual: ${r.layer1.bbwCurrent.value}% (Percentil Histórico: ${r.layer1.bbwHistoryPercentile.value}%, Proveniência: ${r.layer1.bbwCurrent.provenance})`);
    }
    if (r.layer2) {
      console.log(`- L2 IV Rank: ${r.layer2.ivRank.value}% (IV Percentile: ${r.layer2.ivPercentile.value}%, DTE: ${r.layer2.selectedExpiration.dte}d)`);
    }
  }
}

main().catch(console.error);
