'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Search, ArrowUpRight, TrendingDown, Layers, Filter, Building2, RefreshCw } from 'lucide-react';
import { US_STOCKS_DATASET, US_DATA_AS_OF } from '@/lib/domain/us-market-data';
import { TastyEquityQuote, TastyLiveMetrics } from '@/lib/services/tastytrade-market.service';
import { DataValue } from '@/components/shared/DataValue';

interface ScreenerViewProps {
  onSelectSymbol?: (symbol: string) => void;
}

export function ScreenerView({ onSelectSymbol }: ScreenerViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [scanLimit, setScanLimit] = useState<number | 'ALL'>(100);
  const [selectedSector, setSelectedSector] = useState<string>('ALL');

  // Estado de dados ao vivo diretamente da Tastytrade API
  const [equityQuotes, setEquityQuotes] = useState<Record<string, TastyEquityQuote>>({});
  const [marketMetrics, setMarketMetrics] = useState<Record<string, TastyLiveMetrics>>({});
  const [fetchStatus, setFetchStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const sectors = useMemo(() => {
    const sSet = new Set<string>();
    US_STOCKS_DATASET.forEach(s => {
      if (s.sector) sSet.add(s.sector);
    });
    return Array.from(sSet);
  }, []);

  const filteredList = useMemo(() => {
    let list = US_STOCKS_DATASET;
    
    // Sector filter
    if (selectedSector !== 'ALL') {
      list = list.filter(item => item.sector === selectedSector);
    }

    // Text search
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toUpperCase();
      list = list.filter(item => item.symbol.includes(q) || item.name.toUpperCase().includes(q));
    }

    // Limit filter
    if (scanLimit !== 'ALL') {
      list = list.slice(0, scanLimit);
    }

    return list;
  }, [searchTerm, scanLimit, selectedSector]);

  const visibleSymbols = useMemo(() => {
    return filteredList.map(item => item.symbol);
  }, [filteredList]);

  // Função para buscar dados em lote na Tastytrade (cotações e métricas de opções)
  const fetchLiveData = React.useCallback((symbols: string[], bypassCache = false) => {
    if (symbols.length === 0) return;

    setFetchStatus('loading');

    // Particiona em lotes de no máximo 100 símbolos por requisição (limite oficial Tastytrade)
    const chunkSize = 100;
    const symbolChunks: string[][] = [];
    for (let i = 0; i < symbols.length; i += chunkSize) {
      symbolChunks.push(symbols.slice(i, i + chunkSize));
    }

    const refreshQuery = bypassCache ? '&refresh=true' : '';

    Promise.all([
      // 1. Cotações de ações/ETFs (spot real)
      Promise.all(
        symbolChunks.map(chunk =>
          fetch(`/api/market/equity-quotes?symbols=${encodeURIComponent(chunk.join(','))}${refreshQuery}`)
            .then(r => r.json())
            .then(res => (res?.success && res?.data ? res.data as Record<string, TastyEquityQuote> : {}))
            .catch(() => ({} as Record<string, TastyEquityQuote>))
        )
      ),
      // 2. Métricas de volatilidade e liquidez (IV Rank real)
      Promise.all(
        symbolChunks.map(chunk =>
          fetch(`/api/market/market-metrics?symbols=${encodeURIComponent(chunk.join(','))}${refreshQuery}`)
            .then(r => r.json())
            .then(res => (res?.success && res?.data ? res.data as Record<string, TastyLiveMetrics> : {}))
            .catch(() => ({} as Record<string, TastyLiveMetrics>))
        )
      )
    ]).then(([quoteChunks, metricChunks]) => {
      const mergedQuotes: Record<string, TastyEquityQuote> = {};
      for (const qMap of quoteChunks) {
        Object.assign(mergedQuotes, qMap);
      }

      const mergedMetrics: Record<string, TastyLiveMetrics> = {};
      for (const mMap of metricChunks) {
        Object.assign(mergedMetrics, mMap);
      }

      setEquityQuotes(mergedQuotes);
      setMarketMetrics(mergedMetrics);
      setFetchStatus('ready');
      setLastUpdated(new Date().toLocaleTimeString('pt-BR'));
    }).catch(() => {
      setFetchStatus('error');
    });
  }, []);

  useEffect(() => {
    fetchLiveData(visibleSymbols, false);
  }, [visibleSymbols, fetchLiveData]);

  const altaList = filteredList.filter(item => item.category === 'ALTA');
  const baixaList = filteredList.filter(item => item.category === 'BAIXA');
  const lateralList = filteredList.filter(item => item.category === 'LATERAL');

  return (
    <section className="space-y-6">
      {/* Search and Filters Header */}
      <div className="bg-[#0c1322] border border-gray-800 p-5 rounded-2xl space-y-4 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white tracking-tight">Rastreador de Oportunidades & Lista de Execução (S&P 500)</h2>
              <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[10px] font-mono font-bold">
                Classificação Técnica + Crivo CNPI-US + Estrutura no Padrão Tastytrade
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <p className="text-xs text-gray-400">
                Lista de ativos filtrados por alinhamento de médias móveis e liquidez de opções.
              </p>
              {fetchStatus === 'loading' ? (
                <span className="text-[10px] text-cyan-400 font-mono bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20 animate-pulse">
                  Conectando à Tastytrade Live API...
                </span>
              ) : fetchStatus === 'ready' ? (
                <span className="text-[10px] text-emerald-400 font-mono bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {/* eslint-disable-next-line local-rules/no-raw-numbers-in-jsx -- contagem de cotações ativas recebidas da Tastytrade (contador de UI) */}
                  Tastytrade Live REST ({Object.keys(equityQuotes).length} cotações ao vivo)
                  {lastUpdated && <span className="text-gray-400 font-normal">· {lastUpdated}</span>}
                </span>
              ) : (
                <span className="text-[10px] text-amber-400 font-mono bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  Cotações ao vivo temporariamente indisponíveis (catálogo estático: {US_DATA_AS_OF})
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchLiveData(visibleSymbols, true)}
              disabled={fetchStatus === 'loading'}
              title="Atualizar cotações ao vivo da Tastytrade agora"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#070b14] border border-gray-700 hover:border-cyan-500 text-xs font-mono text-cyan-400 transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${fetchStatus === 'loading' ? 'animate-spin' : ''}`} />
              Atualizar
            </button>

            <div className="flex items-center gap-1 bg-[#070b14] p-1 rounded-lg border border-gray-800 text-[11px] font-mono">
              <span className="text-gray-400 px-2 flex items-center gap-1">
                <Filter className="w-3 h-3 text-cyan-400" />
                Escanear:
              </span>
              {[50, 100, 250, 'ALL'].map((limit) => (
                <button
                  key={limit}
                  onClick={() => setScanLimit(limit as number | 'ALL')}
                  className={`px-2.5 py-1 rounded transition font-bold ${
                    scanLimit === limit
                      ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-500/40'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {limit === 'ALL' ? 'Todos S&P 500' : `Top ${limit}`}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-800/80 pt-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-72">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Filtrar por ticker (ex: NVDA, AAPL, SPY)..."
                className="w-full bg-[#070b14] border border-gray-700 rounded-lg pl-9 pr-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-cyan-500 uppercase"
              />
            </div>

            <div className="flex items-center gap-2 text-xs font-mono">
              <Building2 className="w-3.5 h-3.5 text-gray-400" />
              <select
                value={selectedSector}
                onChange={(e) => setSelectedSector(e.target.value)}
                className="bg-[#070b14] border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-gray-200 focus:outline-none focus:border-cyan-500"
              >
                {/* eslint-disable-next-line local-rules/no-raw-numbers-in-jsx -- contagem total de ativos monitorados no catalogo (contador de UI) */}
                <option value="ALL">Todos os Setores ({US_STOCKS_DATASET.length} Ações)</option>
                {sectors.map(sec => (
                  <option key={sec} value={sec}>{sec}</option>
                ))}
              </select>
            </div>
          </div>

          <span className="text-xs font-mono text-gray-400">
            Total de Ativos Analisados no Crivo:{' '}
            <strong className="text-white font-bold">
              {/* eslint-disable-next-line local-rules/no-raw-numbers-in-jsx -- contagem de ativos filtrados no crivo do screener (contador de UI) */}
              {filteredList.length}
            </strong>{' '}
            de{' '}
            {/* eslint-disable-next-line local-rules/no-raw-numbers-in-jsx -- contagem total de ativos monitorados no catalogo (contador de UI) */}
            {US_STOCKS_DATASET.length} ações
          </span>
        </div>
      </div>

      {/* 1. ALTA */}
      <div className="bg-[#0c1322] border border-emerald-500/30 rounded-2xl p-5 space-y-4 shadow-lg">
        <div className="flex justify-between items-center border-b border-gray-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <h3 className="text-sm font-bold font-mono text-emerald-400">ALTA — Oportunidades de Compra</h3>
            <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-mono font-bold">
              {/* eslint-disable-next-line local-rules/no-raw-numbers-in-jsx -- quantidade de ativos classificados no regime de alta (contador de lista de UI) */}
              {altaList.length} ativos
            </span>
          </div>
          <span className="text-[10px] font-mono text-gray-400">
            Critério: Tendência de Alta (MM20 &gt; MM50 &gt; MM200) + Fundamentos Aprovados
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {altaList.map((item) => {
            const liveEquity = equityQuotes[item.symbol];
            const liveSpot = liveEquity?.last;
            const liveChange = liveEquity?.changePct;
            const liveMetric = marketMetrics[item.symbol];

            const riskRatio = item.spot > 0 ? (item.spot - item.stop) / item.spot : 0.05;
            const rewardRatio = item.spot > 0 ? (item.alvo1 - item.spot) / item.spot : 0.10;
            const liveStop = liveSpot != null ? liveSpot * (1 - riskRatio) : null;
            const liveAlvo1 = liveSpot != null ? liveSpot * (1 + rewardRatio) : null;

            return (
              <div
                key={item.symbol}
                onClick={() => onSelectSymbol?.(item.symbol)}
                className="p-3.5 rounded-xl bg-[#090e18] border border-gray-800 hover:border-emerald-500/60 hover:bg-[#0d1527] transition cursor-pointer group"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-black font-mono text-sm text-white group-hover:text-emerald-300 flex items-center gap-1">
                      {item.symbol}
                      <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition text-emerald-400" />
                    </div>
                    <div className="text-[10px] text-gray-400 font-sans truncate w-28">{item.name}</div>
                    <div className="text-[9px] text-emerald-500/80 font-mono mt-0.5">{item.sector}</div>
                  </div>
                  <div className="text-right font-mono flex flex-col items-end gap-0.5">
                    <DataValue
                      label="Spot"
                      value={liveSpot ?? item.spot}
                      provenance={liveSpot != null ? 'MEDIDO' : 'ESTIMADO'}
                      source={liveSpot != null ? 'Tastytrade Live REST (/market-data/by-type)' : 'US_STOCKS_DATASET (catálogo estático)'}
                      format="currency"
                      size="sm"
                    />
                    <DataValue
                      label="Var"
                      value={liveChange ?? item.change}
                      provenance={liveChange != null ? 'DERIVADO' : 'ESTIMADO'}
                      source={liveChange != null ? 'Tastytrade (last vs prev-close)' : 'US_STOCKS_DATASET (catálogo estático)'}
                      format="percent"
                      size="sm"
                    />
                  </div>
                </div>
                <div className="mt-3 pt-2 border-t border-gray-800/80 flex justify-between items-center text-[10px] font-mono gap-1">
                  <DataValue
                    label="Stop"
                    value={liveStop ?? item.stop}
                    provenance={liveStop != null ? 'DERIVADO' : 'ESTIMADO'}
                    source={liveStop != null ? 'Derivado do Spot Real (Setup R:R)' : 'US_STOCKS_DATASET (catálogo estático)'}
                    format="currency"
                    size="sm"
                  />
                  <DataValue
                    label="Alvo 1"
                    value={liveAlvo1 ?? item.alvo1}
                    provenance={liveAlvo1 != null ? 'DERIVADO' : 'ESTIMADO'}
                    source={liveAlvo1 != null ? 'Derivado do Spot Real (Setup R:R)' : 'US_STOCKS_DATASET (catálogo estático)'}
                    format="currency"
                    size="sm"
                  />
                  <div className="flex items-center gap-1">
                    {liveMetric?.ivRank != null && (
                      <DataValue
                        label="IVR"
                        value={liveMetric.ivRank}
                        provenance="MEDIDO"
                        source="Tastytrade Live Metrics"
                        format="percent"
                        size="sm"
                      />
                    )}
                    <span>R:R: <strong className="text-cyan-300">{item.rr}</strong></span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. BAIXA */}
      <div className="bg-[#0c1322] border border-rose-500/30 rounded-2xl p-5 space-y-4 shadow-lg">
        <div className="flex justify-between items-center border-b border-gray-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-400"></span>
            <h3 className="text-sm font-bold font-mono text-rose-400">BAIXA — Oportunidades de Venda / Trava Baixa</h3>
            <span className="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 text-[10px] font-mono font-bold">
              {/* eslint-disable-next-line local-rules/no-raw-numbers-in-jsx -- quantidade de ativos classificados no regime de baixa (contador de lista de UI) */}
              {baixaList.length} ativos
            </span>
          </div>
          <span className="text-[10px] font-mono text-gray-400">
            Critério: Tendência de Baixa (MM20 &lt; MM50 &lt; MM200) + Deterioração
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {baixaList.map((item) => {
            const liveEquity = equityQuotes[item.symbol];
            const liveSpot = liveEquity?.last;
            const liveChange = liveEquity?.changePct;
            const liveMetric = marketMetrics[item.symbol];

            return (
              <div
                key={item.symbol}
                onClick={() => onSelectSymbol?.(item.symbol)}
                className="p-3.5 rounded-xl bg-[#090e18] border border-gray-800 hover:border-rose-500/60 hover:bg-[#150e18] transition cursor-pointer group"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-black font-mono text-sm text-white group-hover:text-rose-300 flex items-center gap-1">
                      {item.symbol}
                      <TrendingDown className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition text-rose-400" />
                    </div>
                    <div className="text-[10px] text-gray-400 font-sans truncate w-28">{item.name}</div>
                    <div className="text-[9px] text-rose-400/80 font-mono mt-0.5">{item.sector}</div>
                  </div>
                  <div className="text-right font-mono flex flex-col items-end gap-0.5">
                    <DataValue
                      label="Spot"
                      value={liveSpot ?? item.spot}
                      provenance={liveSpot != null ? 'MEDIDO' : 'ESTIMADO'}
                      source={liveSpot != null ? 'Tastytrade Live REST (/market-data/by-type)' : 'US_STOCKS_DATASET (catálogo estático)'}
                      format="currency"
                      size="sm"
                    />
                    <DataValue
                      label="Var"
                      value={liveChange ?? item.change}
                      provenance={liveChange != null ? 'DERIVADO' : 'ESTIMADO'}
                      source={liveChange != null ? 'Tastytrade (last vs prev-close)' : 'US_STOCKS_DATASET (catálogo estático)'}
                      format="percent"
                      size="sm"
                    />
                  </div>
                </div>
                <div className="mt-2 text-[10px] text-gray-400 font-mono flex justify-between items-center">
                  <span>{item.strategy || 'Bear Put Spread'}</span>
                  {liveMetric?.ivRank != null && (
                    <DataValue
                      label="IVR"
                      value={liveMetric.ivRank}
                      provenance="MEDIDO"
                      source="Tastytrade Live Metrics"
                      format="percent"
                      size="sm"
                    />
                  )}
                </div>
                <div className="mt-2 pt-2 border-t border-gray-800/80 flex justify-between text-[10px] font-mono text-amber-400">
                  <span>⚠ Estratégia de Risco Definido</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. LATERAL */}
      <div className="bg-[#0c1322] border border-purple-500/30 rounded-2xl p-5 space-y-4 shadow-lg">
        <div className="flex justify-between items-center border-b border-gray-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-400"></span>
            <h3 className="text-sm font-bold font-mono text-purple-300">LATERAL — Renda com Opções (Iron Condor / Credit Spreads)</h3>
            <span className="px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 text-[10px] font-mono font-bold">
              {/* eslint-disable-next-line local-rules/no-raw-numbers-in-jsx -- quantidade de ativos classificados no regime lateral (contador de lista de UI) */}
              {lateralList.length} ativos
            </span>
          </div>
          <span className="text-[10px] font-mono text-gray-400">
            Critério: Mercado Lateral + Balanço Aprovado + IV ATM Favorável (DTE 14 a 35)
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {lateralList.map((item) => {
            const liveEquity = equityQuotes[item.symbol];
            const liveSpot = liveEquity?.last;
            const liveChange = liveEquity?.changePct;
            const liveMetric = marketMetrics[item.symbol];

            return (
              <div
                key={item.symbol}
                onClick={() => onSelectSymbol?.(item.symbol)}
                className="p-3.5 rounded-xl bg-[#090e18] border border-gray-800 hover:border-purple-500/60 hover:bg-[#130f22] transition cursor-pointer group"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-black font-mono text-sm text-white group-hover:text-purple-300 flex items-center gap-1">
                      {item.symbol}
                      <Layers className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition text-purple-400" />
                    </div>
                    <div className="text-[10px] text-gray-400 font-sans truncate w-28">{item.name}</div>
                    <div className="text-[9px] text-purple-400/80 font-mono mt-0.5">{item.sector}</div>
                  </div>
                  <div className="text-right font-mono flex flex-col items-end gap-0.5">
                    <DataValue
                      label="Spot"
                      value={liveSpot ?? item.spot}
                      provenance={liveSpot != null ? 'MEDIDO' : 'ESTIMADO'}
                      source={liveSpot != null ? 'Tastytrade Live REST (/market-data/by-type)' : 'US_STOCKS_DATASET (catálogo estático)'}
                      format="currency"
                      size="sm"
                    />
                    <DataValue
                      label="Var"
                      value={liveChange ?? item.change}
                      provenance={liveChange != null ? 'DERIVADO' : 'ESTIMADO'}
                      source={liveChange != null ? 'Tastytrade (last vs prev-close)' : 'US_STOCKS_DATASET (catálogo estático)'}
                      format="percent"
                      size="sm"
                    />
                  </div>
                </div>
                <div className="mt-2 text-[10px] text-cyan-300 font-mono">Iron Condor #20 a Crédito (4 Pernas)</div>
                <div className="mt-1 text-[10px] text-gray-400 font-mono flex justify-between items-center">
                  <span>
                    IV Rank:{' '}
                    <DataValue
                      variant="inline"
                      value={liveMetric?.ivRank ?? item.ivRank}
                      format="percent"
                      provenance={liveMetric?.ivRank != null ? 'MEDIDO' : 'ESTIMADO'}
                      source={liveMetric?.ivRank != null ? 'Tastytrade Live Metrics' : 'US_STOCKS_DATASET (catálogo estático)'}
                    />
                  </span>
                  <span className="text-emerald-400 font-bold">Crédito</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}