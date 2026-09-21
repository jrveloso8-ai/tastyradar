/**
 * REGRA 00 — INTEGRIDADE DO DADO EXIBIDO
 * RUNNER DE MODO SOMBRA (PAPER TRADING) — SCREENER V1
 *
 * Execução ponta a ponta contra dados REAIS da Tastytrade:
 * - Candles diários via DXLink (WebSocket).
 * - Spot quotes, IV Rank/Percentile e Option Chains via REST.
 * - Orquestrador funcional V1 (Camadas 0, 1, 2, Liquidez, Estrutura).
 * - Zero envio de ordens (estritamente leitura e registro de decisão).
 * - Persistência imutável dos resultados em JSON e Markdown para auditoria.
 */

import fs from 'fs';
import path from 'path';
import { dxlinkCandleCollectorService } from '../src/lib/services/dxlink-candle-collector.service';
import { tastyMarketService } from '../src/lib/services/tastytrade-market.service';
import { tastyAuthService } from '../src/lib/services/tastytrade-auth.service';
import { fetchRealGreeks } from '../src/lib/services/tastytrade-dxlink.service';
import { runScreenerV1Pipeline, CandidateMarketDataV1 } from '../src/lib/domain/screener-v1-orchestrator';
import { ScreenerCandidateInput } from '../src/lib/types/low-vol-screener.types';

import { SP500_DATASET } from '../src/lib/domain/sp500-dataset';
import { US_STOCKS_DATASET } from '../src/lib/domain/us-market-data';
import { normalizeSector } from '../src/lib/domain/sector-normalizer';

// Rotulo de origem rastreada: bid/ask via REST /market-data/by-type, OI via DXLink Summary.
const CHAIN_QUOTE_SOURCE = 'tastytrade-market-data-by-type (bid/ask) + dxlink-summary (open interest)';
const OI_STREAM_WAIT_MS = 8000;

// Universo de Ativos Elegíveis (Diversificação nos 11 Setores GICS - Amostra 20 ativos)
export const SHADOW_UNIVERSE = [
  { symbol: 'AAPL', sector: 'Information Technology' },
  { symbol: 'MSFT', sector: 'Information Technology' },
  { symbol: 'NVDA', sector: 'Information Technology' },
  { symbol: 'AMZN', sector: 'Consumer Discretionary' },
  { symbol: 'TSLA', sector: 'Consumer Discretionary' },
  { symbol: 'JNJ', sector: 'Health Care' },
  { symbol: 'PFE', sector: 'Health Care' },
  { symbol: 'JPM', sector: 'Financials' },
  { symbol: 'BAC', sector: 'Financials' },
  { symbol: 'XOM', sector: 'Energy' },
  { symbol: 'CVX', sector: 'Energy' },
  { symbol: 'PG', sector: 'Consumer Staples' },
  { symbol: 'KO', sector: 'Consumer Staples' },
  { symbol: 'CAT', sector: 'Industrials' },
  { symbol: 'GE', sector: 'Industrials' },
  { symbol: 'NEE', sector: 'Utilities' },
  { symbol: 'LIN', sector: 'Materials' },
  { symbol: 'PLD', sector: 'Real Estate' },
  { symbol: 'GOOGL', sector: 'Communication Services' },
  { symbol: 'META', sector: 'Communication Services' },
];

/**
 * Lista de classes secundárias excluídas para evitar distorção de percentil e dupla cota setorial.
 * - Exclusão de GOOG (Alphabet Classe C): Mantém-se GOOGL (Classe A, maior liquidez e aprovada no Ciclo 1).
 */
export const EXCLUDED_DUPLICATE_CLASSES = new Set(['GOOG']);

/**
 * Subconjunto curado por liquidez e faixa de preço 
 * (80 tickers únicos combinados de SP500_DATASET e US_STOCKS_DATASET, pós-desduplicação e normalização GICS)
 */
function buildCuratedUniverse(): { symbol: string; sector: string }[] {
  const map = new Map<string, { symbol: string; sector: string }>();
  
  // 1. Catálogo Base (SP500_DATASET - 48 tickers)
  for (const s of SP500_DATASET) {
    if (!EXCLUDED_DUPLICATE_CLASSES.has(s.symbol)) {
      map.set(s.symbol, { symbol: s.symbol, sector: normalizeSector(s.symbol, s.sector) });
    }
  }

  // 2. Catálogo Complementar (US_STOCKS_DATASET - 32 tickers adicionais líquidos)
  for (const u of US_STOCKS_DATASET) {
    if (!EXCLUDED_DUPLICATE_CLASSES.has(u.symbol) && !map.has(u.symbol)) {
      map.set(u.symbol, { symbol: u.symbol, sector: normalizeSector(u.symbol, u.sector) });
    }
  }
  
  return Array.from(map.values());
}

export const CURATED_80_UNIVERSE = buildCuratedUniverse();

export async function runShadowCycle(universe = process.argv.includes('--full') ? CURATED_80_UNIVERSE : SHADOW_UNIVERSE) {
  const timestamp = new Date();
  const dateIso = timestamp.toISOString();
  const fileDateStr = dateIso.replace(/[:.]/g, '-');
  const runId = `shadow-v1-${fileDateStr}`;

  console.log(`\n======================================================`);
  console.log(`[MODO SOMBRA V1] Iniciando ciclo de auditoria: ${runId}`);
  console.log(`Timestamp: ${dateIso}`);
  console.log(`Universo: ${universe.length} ativos em ${new Set(universe.map(u => u.sector)).size} setores GICS.`);
  console.log(`======================================================\n`);

  const symbols = universe.map((u) => u.symbol);

  // 1. Captura de Candles Diários Reais via DXLink
  console.log(`1/4. Coletando histórico de candles diários via DXLink WebSocket...`);
  const candlesCollectionMap = await dxlinkCandleCollectorService.collectDailyCandles(symbols, {
    minBarsRequired: 250,
    timeoutMs: 20000,
  });

  // 2. Consulta Cotações à Vista e Métricas de IV
  console.log(`2/4. Consultando cotações de spot e métricas oficiais de IV...`);
  const spotQuotes = await tastyMarketService.getEquityQuotes(symbols);

  const token = await tastyAuthService.getAccessToken();
  const metricsRes = await fetch(`https://api.tastytrade.com/market-metrics?symbols=${symbols.join(',')}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'User-Agent': 'RadarTastytrade/1.0',
    },
  });
  const metricsRaw = await metricsRes.json();
  const metricsItems = metricsRaw.data?.items || [];
  const metricsBySym = new Map<string, any>(metricsItems.map((item: any) => [item.symbol, item]));

  // 3. Monta Candidatos e Consulta Cadeias de Opções
  console.log(`3/4. Consultando cadeias de opções e montando MarketData...`);
  const candidates: ScreenerCandidateInput[] = [];
  const marketDataMap = new Map<string, CandidateMarketDataV1>();

  for (const item of universe) {
    const sym = item.symbol;
    const candleRes = candlesCollectionMap.get(sym);
    const bars = candleRes?.bars || [];

    const hasCandleSource = Boolean(candleRes?.source);
    const barsProvenance = hasCandleSource ? (candleRes!.provenance || 'MEDIDO') : 'INDISPONIVEL';
    const barsSource = hasCandleSource ? candleRes!.source : 'fonte-nao-informada';

    candidates.push({
      symbol: sym,
      sector: item.sector,
      bars,
      barsProvenance,
      barsSource,
    });

    const spot = spotQuotes[sym]?.last ?? null;
    const mItem = metricsBySym.get(sym);
    const rawIvr = mItem ? mItem['tos-implied-volatility-index-rank'] ?? mItem['implied-volatility-index-rank'] : null;
    const rawIvp = mItem ? mItem['implied-volatility-percentile'] : null;
    const rawAtmIvStr = mItem?.['implied-volatility-30-day'];
    const atmIv = rawAtmIvStr ? parseFloat(rawAtmIvStr) / 100 : null;

    let chainStrikes: any[] = [];
    let expirations: any[] = [];

    try {
      const chain = await tastyMarketService.getOptionChain(sym);
      if (chain && chain.expirations.length > 0) {
        expirations = chain.expirations.map((e) => ({
          expirationDate: e.expirationDate,
          daysToExpiration: e.daysToExpiration,
          expirationType: e.expirationType,
          settlementType: e.settlementType,
        }));

        // Identifica ciclo na janela 30-45 DTE
        const targetExp = chain.expirations.find(
          (e) => e.daysToExpiration >= 30 && e.daysToExpiration <= 45
        ) || chain.expirations[0];

        if (targetExp && spot != null && spot > 0) {
          const sorted = [...targetExp.strikes].sort((a, b) => a.strike - b.strike);
          const nearStrikes = sorted.filter((s) => Math.abs(s.strike - spot) / spot < 0.12);
          const occSymbols = nearStrikes.flatMap((s) => [s.callSymbol, s.putSymbol]);
          const quotesMap = await tastyMarketService.getOptionQuotes(occSymbols);
          // Open Interest REAL via DXLink (evento Summary). Sem resposta => null (INDISPONIVEL), nunca constante.
          const streamerSymbols = nearStrikes.flatMap((s) => [s.callStreamerSymbol, s.putStreamerSymbol]);
          const oiMap = await fetchRealGreeks(streamerSymbols, OI_STREAM_WAIT_MS);

          for (const s of nearStrikes) {
            const callQ = quotesMap.get(s.callSymbol);
            const putQ = quotesMap.get(s.putSymbol);
            chainStrikes.push({
              strike: s.strike,
              callSymbol: s.callSymbol,
              putSymbol: s.putSymbol,
              callBid: callQ?.bid ?? null,
              callAsk: callQ?.ask ?? null,
              callOi: oiMap.get(s.callStreamerSymbol)?.openInterest ?? null,
              callSource: callQ ? CHAIN_QUOTE_SOURCE : undefined,
              putBid: putQ?.bid ?? null,
              putAsk: putQ?.ask ?? null,
              putOi: oiMap.get(s.putStreamerSymbol)?.openInterest ?? null,
              putSource: putQ ? CHAIN_QUOTE_SOURCE : undefined,
            });
          }
        }
      }
    } catch (err: any) {
      console.warn(`[Modo Sombra] Aviso ao consultar chain de ${sym}: ${err.message}`);
    }

    marketDataMap.set(sym, {
      spotPrice: spot,
      chainStrikes,
      optionMetrics: {
        rawIvr: rawIvr != null ? parseFloat(rawIvr) : null,
        rawIvp: rawIvp != null ? parseFloat(rawIvp) : null,
        atmIv,
        expirations,
        source: 'tastytrade-market-metrics',
      },
    });
  }

  // 4. Executa o Funil Matemático Completo V1
  console.log(`4/4. Executando orquestrador funcional V1 (Camadas 0 -> 1 -> 2 -> Liquidez -> Estrutura)...`);
  const results = runScreenerV1Pipeline(candidates, marketDataMap);

  const approvedList = results.filter((r) => r.status === 'APPROVED_FOR_EXECUTION');
  const rejectedList = results.filter((r) => r.status === 'REJECTED');

  const pricePassCount = results.filter((r) => r.layer0.passesPriceThreshold !== false).length;
  const l0PassCount = results.filter((r) => r.layer0.passesPriceThreshold !== false && r.layer0.passesHvPercentile && r.layer0.passesStability && r.layer0.sectorQuotaApproved).length;
  const l1PassCount = results.filter((r) => r.layer1 && r.layer1.passesSqueeze).length;
  const l2PassCount = results.filter((r) => r.layer2 && r.layer2.passesIvFilter && r.layer2.selectedExpiration.dte > 0).length;

  console.log(`\n======================================================`);
  console.log(`[RESULTADO DO CICLO MODO SOMBRA]`);
  console.log(`Total Avaliados: ${results.length}`);
  console.log(`Passaram Filtro de Preço (< $100): ${pricePassCount}`);
  console.log(`Passaram Camada 0 (HV Histórico):  ${l0PassCount}`);
  console.log(`Passaram Camada 1 (BBW Squeeze):   ${l1PassCount}`);
  console.log(`Passaram Camada 2 (IVR/IVP/DTE):   ${l2PassCount}`);
  console.log(`Aprovados Finais (Strangle):       ${approvedList.length}`);
  console.log(`======================================================\n`);

  // 5. Estruturação do Log JSON
  const outputJson = {
    runId,
    executedAt: dateIso,
    marketSession: dateIso.split('T')[0],
    universeSize: results.length,
    funnelSummary: {
      totalEvaluated: results.length,
      priceFilterApproved: pricePassCount,
      layer0Approved: l0PassCount,
      layer1Approved: l1PassCount,
      layer2Approved: l2PassCount,
      finalApproved: approvedList.length,
    },
    approvedStrategies: approvedList.map((a) => ({
      symbol: a.candidate.symbol,
      sector: a.candidate.sector,
      structureType: a.strategy?.structureType,
      positionDirection: a.strategy?.positionDirection,
      selectedExpiration: a.strategy?.expiration,
      callLeg: a.strategy?.callLeg,
      putLeg: a.strategy?.putLeg,
      totalDebitMid: a.strategy?.totalDebitMid,
      provenance: a.strategy?.provenance,
    })),
    detailedEvaluations: results.map((r) => ({
      symbol: r.candidate.symbol,
      sector: r.candidate.sector,
      status: r.status,
      rejectionStage: r.rejectionStage || null,
      rejectionCode: r.layer0?.rejectionCode || r.layer1?.rejectionCode || r.layer2?.rejectionCode || null,
      rejectionReason: r.rejectionReason || null,
      layer0: {
        spotPrice: r.layer0.spotPrice,
        passesPriceThreshold: r.layer0.passesPriceThreshold,
        hv12m: r.layer0.hv12m,
        hv12mTrimmed: r.layer0.hv12mTrimmed,
        hvDropRatio: r.layer0.hvDropRatio,
        hv12mPercentile: r.layer0.hv12mPercentile,
        passesHvPercentile: r.layer0.passesHvPercentile,
        passesStability: r.layer0.passesStability,
        sectorQuotaApproved: r.layer0.sectorQuotaApproved,
      },
      layer1: r.layer1
        ? {
            bbwCurrent: r.layer1.bbwCurrent,
            bbwHistoryPercentile: r.layer1.bbwHistoryPercentile,
            passesSqueeze: r.layer1.passesSqueeze,
          }
        : null,
      layer2: r.layer2
        ? {
            ivRank: r.layer2.ivRank,
            ivPercentile: r.layer2.ivPercentile,
            passesIvFilter: r.layer2.passesIvFilter,
            selectedExpiration: r.layer2.selectedExpiration,
          }
        : null,
    })),
  };

  // 6. Estruturação do Relatório Markdown
  let markdown = `# Relatório de Auditoria: Modo Sombra (Paper Trading) — Screener V1\n\n`;
  markdown += `- **ID do Ciclo:** \`${runId}\`\n`;
  markdown += `- **Data/Hora:** \`${dateIso}\`\n`;
  markdown += `- **Universo Avaliado:** ${results.length} ativos (${new Set(universe.map(u => u.sector)).size} setores GICS)\n`;
  markdown += `- **Aprovados Finais:** **${approvedList.length}**\n\n`;

  markdown += `## 1. Funil de Passagem por Camada\n\n`;
  markdown += `| Camada Funcional | Critério de Corte | Aprovados | Taxa de Passagem |\n`;
  markdown += `|---|---|---|---|\n`;
  markdown += `| **Camada 0: HV Histórico** | Garman-Klass Percentil $\\ge 65\\%$, Queda $\\le 40\\%$, Cota Setorial | ${l0PassCount} / ${results.length} | ${((l0PassCount / results.length) * 100).toFixed(1)}% |\n`;
  markdown += `| **Camada 1: Squeeze BBW** | BBW(20,2) Percentil Histórico $\\le 15\\%$ | ${l1PassCount} / ${l0PassCount} | ${l0PassCount > 0 ? ((l1PassCount / l0PassCount) * 100).toFixed(1) : '0.0'}% |\n`;
  markdown += `| **Camada 2: Confirmação IV** | IV Rank e IV Percentile $\\le 30.0$ + DTE 30-45d | ${l2PassCount} / ${l1PassCount} | ${l1PassCount > 0 ? ((l2PassCount / l1PassCount) * 100).toFixed(1) : '0.0'}% |\n`;
  markdown += `| **Final: Liquidez & Strangle** | Bid/Ask Spread $\\le 10\\%$ e $\\text{OI} \\ge 250$ | **${approvedList.length}** / ${l2PassCount} | ${l2PassCount > 0 ? ((approvedList.length / l2PassCount) * 100).toFixed(1) : '0.0'}% |\n\n`;

  if (approvedList.length > 0) {
    markdown += `## 2. Estruturas Eleitas (Long Strangle — Débito) — Registro de Decisão\n\n`;
    for (const app of approvedList) {
      const st = app.strategy!;
      const totalDebitMid = st.totalDebitMid;
      markdown += `### Ticker: **${app.candidate.symbol}** (${app.candidate.sector})\n`;
      markdown += `- **Estrutura:** ${st.structureType} (${st.positionDirection}) | **Proveniência:** \`${st.provenance}\`\n`;
      markdown += `- **Vencimento Selecionado:** \`${st.expiration.expirationDate}\` (**DTE: ${st.expiration.dte} dias**, Regra: \`${st.expiration.selectionRule}\`)\n`;
      const callSpreadStr = st.callLeg.relativeSpread !== null ? `${(st.callLeg.relativeSpread * 100).toFixed(1)}%` : 'INDISPONIVEL';
      const putSpreadStr = st.putLeg.relativeSpread !== null ? `${(st.putLeg.relativeSpread * 100).toFixed(1)}%` : 'INDISPONIVEL';
      markdown += `- **Perna Call OTM (BUY):** Strike **$${st.callLeg.strike}** | Bid: $${st.callLeg.bid} | Ask: $${st.callLeg.ask} | Mid: $${st.callLeg.mid} | Spread: ${callSpreadStr} | OI: ${st.callLeg.openInterest ?? 'INDISPONIVEL'}\n`;
      markdown += `- **Perna Put OTM (BUY):** Strike **$${st.putLeg.strike}** | Bid: $${st.putLeg.bid} | Ask: $${st.putLeg.ask} | Mid: $${st.putLeg.mid} | Spread: ${putSpreadStr} | OI: ${st.putLeg.openInterest ?? 'INDISPONIVEL'}\n`;
      markdown += `- **Débito Teórico Mid (Custo da Estrutura):** **$${totalDebitMid}** (${st.provenance} - sum-of-bought-leg-mids)\n\n`;
    }
  } else {
    markdown += `## 2. Estruturas Eleitas\n\n`;
    markdown += `> **Nenhum ativo foi aprovado neste ciclo.** Registro explícito conforme exigência do Ponto de Observação 2.\n\n`;
  }

  markdown += `## 3. Avaliação Completa do Universo (Auditoria Rejeição a Rejeição)\n\n`;
  markdown += `| Símbolo | Setor GICS | Status | Estágio de Rejeição | Código de Rejeição | Motivo Auditável |\n`;
  markdown += `|---|---|---|---|---|---|\n`;
  for (const r of results) {
    const stage = r.rejectionStage || '-';
    const code = r.layer0?.rejectionCode || r.layer1?.rejectionCode || r.layer2?.rejectionCode || '-';
    const reason = r.rejectionReason || 'Aprovado em todas as camadas';
    markdown += `| **${r.candidate.symbol}** | ${r.candidate.sector} | \`${r.status}\` | ${stage} | \`${code}\` | ${reason} |\n`;
  }

  // 7. Persistência dos Arquivos
  const logDir = path.join(process.cwd(), 'docs', 'logs', 'shadow-mode');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  const jsonPath = path.join(logDir, `shadow-run-${fileDateStr}.json`);
  const mdPath = path.join(logDir, `shadow-run-${fileDateStr}.md`);

  fs.writeFileSync(jsonPath, JSON.stringify(outputJson, null, 2), 'utf8');
  fs.writeFileSync(mdPath, markdown, 'utf8');

  console.log(`Arquivos salvos com sucesso:`);
  console.log(`- JSON: ${jsonPath}`);
  console.log(`- MD:   ${mdPath}\n`);

  return { outputJson, mdPath, jsonPath };
}

// Permite execução direta via CLI
if (require.main === module) {
  runShadowCycle().catch((err) => {
    console.error('[ERRO CRÍTICO NO RUNNER DO MODO SOMBRA]:', err);
    process.exit(1);
  });
}
