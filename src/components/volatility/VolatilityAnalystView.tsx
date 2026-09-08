'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { 
  Gauge, 
  Activity, 
  TrendingUp, 
  TrendingDown, 
  ShieldCheck, 
  AlertTriangle, 
  Clock, 
  Copy, 
  Check, 
  Layers, 
  Sliders, 
  Zap, 
  ArrowRight,
  Search,
  BookOpen,
  HelpCircle,
  X,
  Target,
  Shield,
  ShieldAlert,
  Percent,
  Compass,
  Sparkles,
  RefreshCw,
  Wifi,
  Radio
} from 'lucide-react';
import { volatilityEngine, VolatilityAssetInput, VolatilityRecommendation } from '@/lib/domain/volatility-engine';
import { generateCandlesticks, CandleDataPoint } from '@/lib/domain/us-market-data';

import { 
  SP500_DATASET, 
  getTop50LiquidUnder150, 
  searchSP500, 
  getSP500Asset, 
  SP500StockData 
} from '@/lib/domain/sp500-dataset';

interface VolatilityAnalystViewProps {
  onNavigateToQuote?: (symbol: string) => void;
  onNavigateToGex?: (symbol: string) => void;
}

export function VolatilityAnalystView({ onNavigateToQuote, onNavigateToGex }: VolatilityAnalystViewProps) {
  const [selectedSymbol, setSelectedSymbol] = useState<string>('NVDA');
  const [activeFilter, setActiveFilter] = useState<'TOP_50_UNDER_150' | 'ALL' | 'SELL_VOL' | 'BUY_VOL' | 'WALL_SNIPER'>('TOP_50_UNDER_150');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isSearchFocused, setIsSearchFocused] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [activeChartTab, setActiveChartTab] = useState<'PRICE_OI' | 'VOL_HISTORIC' | 'VOL_SMILE'>('PRICE_OI');
  const [showDidacticModal, setShowDidacticModal] = useState<boolean>(false);

  // Estados de conexão Live com a API Oficial da Tastytrade
  const [liveMetricsMap, setLiveMetricsMap] = useState<Record<string, any>>({});
  const [isLiveConnected, setIsLiveConnected] = useState<boolean>(false);
  const [isRefreshingLive, setIsRefreshingLive] = useState<boolean>(false);

  // Lista base pelo filtro selecionado
  const baseList = useMemo(() => {
    if (activeFilter === 'TOP_50_UNDER_150') return getTop50LiquidUnder150();
    if (activeFilter === 'SELL_VOL') return SP500_DATASET.filter(s => s.ivr >= 50);
    if (activeFilter === 'BUY_VOL') return SP500_DATASET.filter(s => s.ivr < 35);
    if (activeFilter === 'WALL_SNIPER') {
      return SP500_DATASET.filter(s => {
        const distToPut = Math.abs(s.spot - s.putWall) / s.spot;
        const distToCall = Math.abs(s.spot - s.callWall) / s.spot;
        return distToPut < 0.03 || distToCall < 0.03;
      });
    }
    return SP500_DATASET;
  }, [activeFilter]);

  // Efeito de sincronização em tempo real com a API da Tastytrade
  useEffect(() => {
    let isCancelled = false;

    async function syncLiveMetrics() {
      try {
        setIsRefreshingLive(true);
        // Busca métricas para o ativo selecionado + os primeiros da grade visível
        const symbolsToFetch = Array.from(new Set([
          selectedSymbol.toUpperCase(),
          ...baseList.slice(0, 15).map(s => s.symbol.toUpperCase())
        ])).join(',');

        const res = await fetch(`/api/market/metrics?symbols=${symbolsToFetch}`);
        if (!res.ok) return;
        const json = await res.json();

        if (!isCancelled && json.success && json.data) {
          setLiveMetricsMap(prev => ({ ...prev, ...json.data }));
          if (json.live) {
            setIsLiveConnected(true);
          }
        }
      } catch (err) {
        console.warn('[VolatilityAnalystView] Não foi possível obter live metrics:', err);
      } finally {
        if (!isCancelled) setIsRefreshingLive(false);
      }
    }

    syncLiveMetrics();

    return () => {
      isCancelled = true;
    };
  }, [selectedSymbol, baseList]);

  // Sugestões instantâneas da busca global no S&P 500
  const searchSuggestions = useMemo(() => {
    if (!searchTerm.trim()) return [];
    return searchSP500(searchTerm).slice(0, 8);
  }, [searchTerm]);

  // Lista filtrada e enriquecida com dados ao vivo da Tastytrade
  const filteredAssets = useMemo(() => {
    let list = baseList;
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toUpperCase();
      list = searchSP500(q);
    }
    return list.slice(0, 50).map(item => {
      const live = liveMetricsMap[item.symbol.toUpperCase()];
      const enrichedItem: SP500StockData = live ? {
        ...item,
        ivr: live.ivRank ?? item.ivr,
        ivp: live.ivPercentile ?? item.ivp,
        iv30: live.iv30 ?? item.iv30,
        liquidityRating: live.liquidityRating ?? item.liquidityRating,
        daysToEarnings: live.daysToEarnings !== undefined ? live.daysToEarnings : item.daysToEarnings,
      } : item;

      return {
        ...enrichedItem,
        evaluation: volatilityEngine.evaluate(enrichedItem)
      };
    });
  }, [baseList, searchTerm, liveMetricsMap]);

  // Ativo atualmente selecionado enriquecido dinamicamente com a API Live
  const selectedAsset = useMemo(() => {
    const asset = getSP500Asset(selectedSymbol);
    const live = liveMetricsMap[selectedSymbol.toUpperCase()];
    if (!live) return asset;

    return {
      ...asset,
      ivr: live.ivRank ?? asset.ivr,
      ivp: live.ivPercentile ?? asset.ivp,
      iv30: live.iv30 ?? asset.iv30,
      liquidityRating: live.liquidityRating ?? asset.liquidityRating,
      daysToEarnings: live.daysToEarnings !== undefined ? live.daysToEarnings : asset.daysToEarnings,
      dividendAmount: live.dividendYield ? Number((asset.spot * (live.dividendYield / 100)).toFixed(2)) : asset.dividendAmount,
      hvHistory: (live.hv90 !== undefined && live.hv60 !== undefined && live.hv30 !== undefined)
        ? [live.hv90, live.hv60, live.hv30]
        : asset.hvHistory,
    };
  }, [selectedSymbol, liveMetricsMap]);

  // Avaliação determinística completa do ativo ativo
  const rec = useMemo(() => {
    return volatilityEngine.evaluate(selectedAsset);
  }, [selectedAsset]);

  const rationale = rec.didacticRationale;

  // Candlesticks simulados dos últimos 40 dias para o gráfico de preço com OI
  const candles: CandleDataPoint[] = useMemo(() => {
    return generateCandlesticks(selectedAsset.symbol, selectedAsset.spot, 40);
  }, [selectedAsset.symbol, selectedAsset.spot]);

  // Parâmetros de escala do gráfico de preço
  const chartMinPrice = Math.min(...candles.map(c => c.low), rec.putWall * 0.97);
  const chartMaxPrice = Math.max(...candles.map(c => c.high), rec.callWall * 1.03);
  const chartPriceRange = chartMaxPrice - chartMinPrice || 1;

  const getYCoord = (price: number) => {
    return 140 - ((price - chartMinPrice) / chartPriceRange) * 115;
  };

  const handleCopyOrder = () => {
    if (!rec) return;
    navigator.clipboard.writeText(rec.formattedTextOutput);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="space-y-6">
      
      {/* BANNER GLOBAL DE TRANSPARÊNCIA E AUDITORIA (Fase 0 - Achados A-07/A-08) */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-amber-200">
        <div className="flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            <strong>Aviso de Transparência Quantitativa:</strong> Métricas de IV Rank e IV 30d são sincronizadas com a API Tastytrade. Parâmetros de payoff e ordens operam com modelos calibrados. Sempre confirme no book oficial antes de investir.
          </span>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold shrink-0">
          PROVENIÊNCIA RASTREADA
        </span>
      </div>

      {/* 1. BARRA MACRO DO MERCADO AMERICANO (§5.2 da skill) */}
      <div className="bg-[#0c1322] border border-gray-800/90 rounded-2xl p-4 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-400 shadow-sm">
              <Gauge className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-sm font-bold text-white font-mono tracking-tight">
                  Analista de Volatilidade & Riscos Institucionais
                </h1>
                <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 font-mono font-bold">
                  SKILL: analista-senior-opcoes-us
                </span>
                {liveMetricsMap[selectedSymbol.toUpperCase()]?.source === 'tastytrade-live' ? (
                  <span 
                    className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 font-mono font-bold flex items-center gap-1.5 shadow-sm"
                    title="Métricas de volatilidade oficiais recebidas diretamente da API da Tastytrade em tempo real"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>AO VIVO (TASTYTRADE: {selectedSymbol})</span>
                    {isRefreshingLive && <RefreshCw className="w-2.5 h-2.5 animate-spin text-emerald-400" />}
                  </span>
                ) : liveMetricsMap[selectedSymbol.toUpperCase()] ? (
                  <span 
                    className="text-[10px] px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/40 font-mono flex items-center gap-1.5"
                    title="Dado quantitativo prévio calibrado em cache/referencial"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    <span>MODELO CALIBRADO</span>
                  </span>
                ) : (
                  <span 
                    className="text-[10px] px-2.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-mono flex items-center gap-1.5"
                    title="Consultando banco de dados quantitativo S&P 500 com suporte a sincronização live"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                    <span>SINCRONIZANDO TASTYTRADE...</span>
                    {isRefreshingLive && <RefreshCw className="w-2.5 h-2.5 animate-spin text-cyan-400" />}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 font-sans">
                Monitoramento contínuo de IV Rank, VRP Yang-Zhang e barreiras GEX para o mercado americano.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 font-mono text-xs">
            <div className="bg-[#070b14] px-3 py-1.5 rounded-xl border border-gray-800 flex items-center gap-2">
              <span className="text-gray-400">VIX Spot:</span>
              <strong className="text-emerald-400">15.42</strong>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-300 font-bold">CONTANGO</span>
            </div>
            <div className="bg-[#070b14] px-3 py-1.5 rounded-xl border border-gray-800 flex items-center gap-2">
              <span className="text-gray-400">VIX9D/VIX3M:</span>
              <strong className="text-cyan-300">0.86</strong>
              <span className="text-[9px] text-gray-400">(Calmo &lt; 1.0)</span>
            </div>
            <div className="bg-[#070b14] px-3 py-1.5 rounded-xl border border-gray-800 flex items-center gap-2">
              <span className="text-gray-400">CBOE SKEW:</span>
              <strong className="text-amber-400">138.2</strong>
              <span className="text-[9px] text-amber-300/80 font-bold">Tail Risk</span>
            </div>
            <div className="bg-[#070b14] px-3 py-1.5 rounded-xl border border-emerald-500/30 flex items-center gap-2 shadow-sm">
              <span className="text-gray-400">SPX Net GEX:</span>
              <strong className="text-emerald-400">+$3.82 B</strong>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-bold">+GEX AMORTECIDO</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. SCANNER GRID + FICHA OPERACIONAL (LADO A LADO) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* COLUNA ESQUERDA: GRADE SCANNER + GRÁFICO COM LINHAS DE OI (7 colunas) */}
        <div className="lg:col-span-7 space-y-4">
          
          <div className="bg-[#0c1322] border border-gray-800 rounded-2xl p-4 space-y-3 shadow-lg">
            
            {/* Filtros e Busca */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-800 pb-3">
              <div className="flex flex-wrap items-center gap-1.5 bg-[#070b14] p-1 rounded-xl border border-gray-800 text-xs font-mono">
                <button 
                  onClick={() => setActiveFilter('TOP_50_UNDER_150')}
                  className={`px-3 py-1 rounded-lg transition font-bold flex items-center gap-1.5 ${
                    activeFilter === 'TOP_50_UNDER_150'
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                      : 'text-gray-400 hover:text-white'
                  }`}
                  title="Filtra as 50 ações mais líquidas do S&P 500 com cotação abaixo de $150 para mitigar risco e margem"
                >
                  <span>💎 Top 50 (&lt; $150)</span>
                </button>
                <button 
                  onClick={() => setActiveFilter('ALL')}
                  className={`px-3 py-1 rounded-lg transition font-bold ${
                    activeFilter === 'ALL'
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Todos S&P 500 ({SP500_DATASET.length})
                </button>
                <button 
                  onClick={() => setActiveFilter('SELL_VOL')}
                  className={`px-3 py-1 rounded-lg transition font-bold ${
                    activeFilter === 'SELL_VOL'
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  ⚡ Venda de Vol (IVR &gt; 50)
                </button>
                <button 
                  onClick={() => setActiveFilter('BUY_VOL')}
                  className={`px-3 py-1 rounded-lg transition font-bold ${
                    activeFilter === 'BUY_VOL'
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  🎯 Compra de Vol (IVR &lt; 35)
                </button>
                <button 
                  onClick={() => setActiveFilter('WALL_SNIPER')}
                  className={`px-3 py-1 rounded-lg transition font-bold ${
                    activeFilter === 'WALL_SNIPER'
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  🛡️ Próximo às Walls
                </button>
              </div>

              {/* Campo de Busca Global em Todo o S&P 500 com Autocomplete Instantâneo */}
              <div className="relative w-52 md:w-64">
                <Search className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-2.5" />
                <input 
                  type="text"
                  value={searchTerm}
                  onFocus={() => setIsSearchFocused(true)}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setIsSearchFocused(true);
                  }}
                  placeholder="Buscar qualquer ação do S&P 500..."
                  className="w-full bg-[#070b14] border border-gray-800 rounded-lg pl-8 pr-7 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-purple-500 uppercase"
                />
                {searchTerm && (
                  <button 
                    onClick={() => {
                      setSearchTerm('');
                      setIsSearchFocused(false);
                    }}
                    className="absolute right-2 top-2 text-gray-500 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* Dropdown de Sugestões Instantâneas do S&P 500 */}
                {isSearchFocused && searchSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-[#0c1322] border border-purple-500/40 rounded-xl shadow-2xl z-40 max-h-64 overflow-y-auto custom-scrollbar divide-y divide-gray-800/60 font-mono text-xs">
                    <div className="px-3 py-1.5 bg-[#070b14] text-[10px] text-gray-400 font-sans flex justify-between items-center">
                      <span>S&P 500 ({searchSuggestions.length} encontrados)</span>
                      <span>Clique para abrir</span>
                    </div>
                    {searchSuggestions.map((item) => (
                      <div
                        key={`sug-${item.symbol}`}
                        onClick={() => {
                          setSelectedSymbol(item.symbol);
                          setIsSearchFocused(false);
                          setSearchTerm('');
                        }}
                        className="px-3 py-2 hover:bg-purple-500/15 cursor-pointer flex justify-between items-center transition"
                      >
                        <div>
                          <div className="font-bold text-white flex items-center gap-1.5">
                            <span>{item.symbol}</span>
                            <span className="text-[10px] text-gray-400 font-sans font-normal truncate max-w-[110px]">{item.name}</span>
                          </div>
                          <div className="text-[9px] text-gray-500 font-sans">{item.sector}</div>
                        </div>
                        <div className="text-right">
                          <div className={`font-bold ${item.spot <= 150 ? 'text-emerald-400' : 'text-gray-300'}`}>
                            ${item.spot.toFixed(2)}
                          </div>
                          <div className="text-[9px] text-purple-300">
                            {'★'.repeat(item.liquidityRating)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Tabela de Scanner com Heatmap */}
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left font-mono text-xs">
                <thead>
                  <tr className="text-[10px] text-gray-400 border-b border-gray-800 uppercase tracking-wider bg-[#070b14]/50">
                    <th className="py-2.5 px-3">Ativo</th>
                    <th className="py-2.5 px-2 text-right">Spot</th>
                    <th className="py-2.5 px-2 text-center">IV Rank</th>
                    <th className="py-2.5 px-2 text-center">IV Perc</th>
                    <th className="py-2.5 px-2 text-center">VRP (YZ)</th>
                    <th className="py-2.5 px-2 text-center">GEX</th>
                    <th className="py-2.5 px-3 text-right">Setup Eleito</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60">
                  {filteredAssets.map(item => {
                    const isSelected = item.symbol === selectedSymbol;
                    const r = item.evaluation;

                    let ivrClass = 'text-gray-300';
                    if (item.ivr >= 65) ivrClass = 'text-rose-400 font-bold bg-rose-500/10 px-1.5 py-0.5 rounded';
                    else if (item.ivr <= 30) ivrClass = 'text-cyan-400 font-bold bg-cyan-500/10 px-1.5 py-0.5 rounded';

                    return (
                      <tr
                        key={item.symbol}
                        onClick={() => setSelectedSymbol(item.symbol)}
                        className={`cursor-pointer transition hover:bg-[#10192e] ${
                          isSelected ? 'bg-purple-500/10 border-l-2 border-purple-400 font-semibold' : ''
                        }`}
                      >
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-white flex items-center gap-1.5">
                            {item.symbol}
                            {isSelected && <Check className="w-3 h-3 text-purple-400" />}
                            {liveMetricsMap[item.symbol.toUpperCase()]?.source === 'tastytrade-live' && (
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Dados Live da Tastytrade" />
                            )}
                          </div>
                          <div className="text-[9px] text-gray-500 font-sans truncate w-24">{item.name}</div>
                        </td>
                        <td className="py-2.5 px-2 text-right">
                          <div className="text-gray-200">${item.spot.toFixed(2)}</div>
                          <div className={`text-[10px] ${item.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {item.change >= 0 ? '+' : ''}{item.change.toFixed(2)}%
                          </div>
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <span className={ivrClass}>{item.ivr.toFixed(1)}%</span>
                        </td>
                        <td className="py-2.5 px-2 text-center text-gray-400">
                          {item.ivp.toFixed(0)}%
                        </td>
                        <td className="py-2.5 px-2 text-center font-semibold">
                          <span className={r.vrp >= 4 ? 'text-emerald-400' : r.vrp < 0 ? 'text-rose-400' : 'text-gray-300'}>
                            {r.vrp >= 0 ? '+' : ''}{r.vrp.toFixed(1)}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-center text-[10px]">
                          <span className={r.gexRegime === '+GEX' ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                            {r.gexRegime}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <span className="px-2 py-0.5 rounded text-[10px] bg-purple-500/15 text-purple-300 border border-purple-500/30">
                            {r.strategy.name.split(' (')[0]}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="pt-2 text-[10px] font-mono text-gray-500 flex justify-between items-center">
              <span>💡 Clique em qualquer linha para abrir a auditoria quantitativa e strikes à direita.</span>
              <span>Regras Taste: 30-45 DTE | 50% Profit | 21 DTE Defesa</span>
            </div>

          </div>

          {/* NOVO: GRÁFICO DINÂMICO COM LINHAS DE OI (WALLS) & ALTERNÂNCIA PARA IV vs HV */}
          <div className="bg-[#0c1322] border border-gray-800 rounded-2xl p-4 shadow-lg space-y-3">
            
            {/* Seletor de Aba do Gráfico */}
            <div className="flex flex-wrap items-center justify-between border-b border-gray-800 pb-2.5 gap-2">
              <div className="flex flex-wrap items-center gap-1.5 bg-[#070b14] p-1 rounded-xl border border-gray-800 text-xs font-mono">
                <button
                  onClick={() => setActiveChartTab('PRICE_OI')}
                  className={`px-2.5 py-1 rounded-lg transition font-bold flex items-center gap-1.5 ${
                    activeChartTab === 'PRICE_OI'
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Target className="w-3.5 h-3.5 text-rose-400" />
                  Preço + Barreiras OI
                </button>
                <button
                  onClick={() => setActiveChartTab('VOL_HISTORIC')}
                  className={`px-2.5 py-1 rounded-lg transition font-bold flex items-center gap-1.5 ${
                    activeChartTab === 'VOL_HISTORIC'
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
                  IV vs HV (Histórico) + IVR & IVP
                </button>
                <button
                  onClick={() => setActiveChartTab('VOL_SMILE')}
                  className={`px-2.5 py-1 rounded-lg transition font-bold flex items-center gap-1.5 ${
                    activeChartTab === 'VOL_SMILE'
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  Smile / Skew de Volatilidade
                </button>
              </div>

              <div className="text-[11px] font-mono text-gray-400 flex items-center gap-2">
                <span>Ativo: <strong className="text-purple-400">{selectedAsset.symbol}</strong></span>
              </div>
            </div>

            {/* Renderização do Gráfico 1: Preço da Ação com Linhas de OI / Walls */}
            {activeChartTab === 'PRICE_OI' && (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between text-[11px] font-mono bg-[#070b14] p-2 rounded-xl border border-gray-800/80">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 text-emerald-400 font-bold">
                      <span className="w-2.5 h-0.5 bg-emerald-400 inline-block"></span>
                      Call Wall: ${rec.callWall.toFixed(2)} (Maior OI Call - Teto)
                    </span>
                    <span className="flex items-center gap-1 text-rose-400 font-bold">
                      <span className="w-2.5 h-0.5 bg-rose-400 inline-block"></span>
                      Put Wall: ${rec.putWall.toFixed(2)} (Maior OI Put - Piso)
                    </span>
                    <span className="flex items-center gap-1 text-cyan-300">
                      <span className="w-2.5 h-0.5 bg-cyan-300 inline-block"></span>
                      Zero Flip: ${rec.zeroGammaFlip.toFixed(2)}
                    </span>
                  </div>
                  <span className="text-gray-400">Spot: <strong className="text-white">${selectedAsset.spot.toFixed(2)}</strong></span>
                </div>

                <div className="h-48 w-full relative bg-[#070b14]/50 rounded-xl border border-gray-900 p-2">
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 520 150" preserveAspectRatio="none">
                    
                    {/* Túnel de OI dos Dealers (Zona Estável entre Put Wall e Call Wall) */}
                    <rect
                      x="0"
                      y={Math.min(getYCoord(rec.callWall), getYCoord(rec.putWall))}
                      width="450"
                      height={Math.abs(getYCoord(rec.putWall) - getYCoord(rec.callWall))}
                      fill="#8b5cf6"
                      fillOpacity="0.06"
                    />

                    {/* Linha da Call Wall (Maior OI Call) */}
                    <line 
                      x1="0" 
                      y1={getYCoord(rec.callWall)} 
                      x2="450" 
                      y2={getYCoord(rec.callWall)} 
                      stroke="#10b981" 
                      strokeDasharray="4 3" 
                      strokeWidth="1.8" 
                    />
                    <text x="455" y={getYCoord(rec.callWall) + 3} fill="#10b981" fontSize="9" fontFamily="JetBrains Mono" fontWeight="bold">
                      Call Wall ${rec.callWall.toFixed(0)}
                    </text>

                    {/* Linha da Put Wall (Maior OI Put) */}
                    <line 
                      x1="0" 
                      y1={getYCoord(rec.putWall)} 
                      x2="450" 
                      y2={getYCoord(rec.putWall)} 
                      stroke="#f43f5e" 
                      strokeDasharray="4 3" 
                      strokeWidth="1.8" 
                    />
                    <text x="455" y={getYCoord(rec.putWall) + 3} fill="#f43f5e" fontSize="9" fontFamily="JetBrains Mono" fontWeight="bold">
                      Put Wall ${rec.putWall.toFixed(0)}
                    </text>

                    {/* Linha do Zero Gamma Flip */}
                    <line 
                      x1="0" 
                      y1={getYCoord(rec.zeroGammaFlip)} 
                      x2="450" 
                      y2={getYCoord(rec.zeroGammaFlip)} 
                      stroke="#22d3ee" 
                      strokeDasharray="2 2" 
                      strokeWidth="1.2" 
                    />
                    <text x="455" y={getYCoord(rec.zeroGammaFlip) + 3} fill="#22d3ee" fontSize="8" fontFamily="JetBrains Mono">
                      Flip ${rec.zeroGammaFlip.toFixed(0)}
                    </text>

                    {/* Linha de Spot Atual */}
                    <line 
                      x1="0" 
                      y1={getYCoord(selectedAsset.spot)} 
                      x2="450" 
                      y2={getYCoord(selectedAsset.spot)} 
                      stroke="#ffffff" 
                      strokeWidth="1.0" 
                      strokeDasharray="2 2"
                      opacity="0.6"
                    />
                    <text x="455" y={getYCoord(selectedAsset.spot) + 3} fill="#ffffff" fontSize="8" fontFamily="JetBrains Mono" opacity="0.8">
                      Spot ${selectedAsset.spot.toFixed(1)}
                    </text>

                    {/* Candles / Barras de Preço da Ação */}
                    {candles.slice(-30).map((c, i) => {
                      const x = (i / 29) * 430 + 10;
                      const yOpen = getYCoord(c.open);
                      const yClose = getYCoord(c.close);
                      const yHigh = getYCoord(c.high);
                      const yLow = getYCoord(c.low);
                      const isUp = c.close >= c.open;
                      const color = isUp ? '#10b981' : '#f43f5e';
                      const bodyTop = Math.min(yOpen, yClose);
                      const bodyHeight = Math.max(2, Math.abs(yClose - yOpen));

                      return (
                        <g key={i}>
                          <line x1={x} y1={yHigh} x2={x} y2={yLow} stroke={color} strokeWidth="1" opacity="0.8" />
                          <rect 
                            x={x - 4} 
                            y={bodyTop} 
                            width={8} 
                            height={bodyHeight} 
                            fill={color} 
                            opacity="0.9"
                            rx="1"
                          />
                        </g>
                      );
                    })}
                  </svg>
                </div>
                <p className="text-[10px] font-mono text-gray-400">
                  🛡️ <strong>Regra Institucional:</strong> Os strikes vendidos do trade ficam ancorados fora do túnel entre a Put Wall (${rec.putWall.toFixed(2)}) e a Call Wall (${rec.callWall.toFixed(2)}), onde o hedge dos formadores amortece o movimento.
                </p>
              </div>
            )}

            {/* Renderização do Gráfico 2: IV vs HV + Representação Visual de IV RANK e IV PERCENTIL */}
            {activeChartTab === 'VOL_HISTORIC' && (
              <div className="space-y-3">
                {/* Métricas do Topo */}
                <div className="flex flex-wrap items-center justify-between text-[11px] font-mono bg-[#070b14] p-2.5 rounded-xl border border-gray-800/80 gap-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-rose-400 font-bold flex items-center gap-1">
                      <span className="w-2.5 h-0.5 bg-rose-400 inline-block"></span>
                      IV 30d: {selectedAsset.iv30.toFixed(1)}%
                    </span>
                    <span className="text-cyan-300 font-bold flex items-center gap-1">
                      <span className="w-2.5 h-0.5 bg-cyan-300 inline-block"></span>
                      HV 20d (Yang-Zhang): {selectedAsset.rv20.toFixed(1)}%
                    </span>
                    <span className={`font-bold ${rec.vrp >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      VRP: {rec.vrp >= 0 ? '+' : ''}{rec.vrp.toFixed(1)} pts
                    </span>
                  </div>
                  <div className="text-[10px] text-gray-400">
                    Canal 52s: <strong className="text-gray-300">{selectedAsset.iv52wMin.toFixed(1)}%</strong> a <strong className="text-amber-400">{selectedAsset.iv52wMax.toFixed(1)}%</strong>
                  </div>
                </div>

                {/* Grade: Gráfico de Curvas + Termômetro de IV Rank & Percentil */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-stretch">
                  
                  {/* Curvas Temporais de IV vs HV com Canal de 52 Semanas (8 colunas) */}
                  <div className="md:col-span-8 bg-[#070b14]/60 rounded-xl border border-gray-900 p-3 flex flex-col justify-between">
                    <div className="h-44 w-full relative">
                      <svg className="w-full h-full overflow-visible" viewBox="0 0 400 130" preserveAspectRatio="none">
                        {/* Linhas de Grade */}
                        <line x1="0" y1="15" x2="330" y2="15" stroke="#1f293d" strokeDasharray="3 3" />
                        <line x1="0" y1="65" x2="330" y2="65" stroke="#1f293d" strokeDasharray="3 3" />
                        <line x1="0" y1="115" x2="330" y2="115" stroke="#1f293d" strokeDasharray="3 3" />

                        {/* Linha de 52w Max (100% IV Rank) */}
                        <line x1="0" y1="18" x2="330" y2="18" stroke="#f59e0b" strokeDasharray="4 3" strokeWidth="1.2" opacity="0.8" />
                        <text x="335" y="21" fill="#f59e0b" fontSize="8" fontFamily="JetBrains Mono" fontWeight="bold">
                          100% IVR ({selectedAsset.iv52wMax.toFixed(0)}%)
                        </text>

                        {/* Linha de 52w Min (0% IV Rank) */}
                        <line x1="0" y1="118" x2="330" y2="118" stroke="#64748b" strokeDasharray="4 3" strokeWidth="1.2" opacity="0.8" />
                        <text x="335" y="121" fill="#94a3b8" fontSize="8" fontFamily="JetBrains Mono">
                          0% IVR ({selectedAsset.iv52wMin.toFixed(0)}%)
                        </text>

                        {/* Área Sombreada de VRP (Prêmio de Risco de Volatilidade) */}
                        <polygon
                          points={`
                            ${selectedAsset.ivHistory.map((v, i) => `${(i / 5) * 320 + 10},${118 - ((v - selectedAsset.iv52wMin) / (selectedAsset.iv52wMax - selectedAsset.iv52wMin || 1)) * 100}`).join(' ')}
                            ${selectedAsset.hvHistory.slice().reverse().map((v, i) => `${((5 - i) / 5) * 320 + 10},${118 - ((v - selectedAsset.iv52wMin) / (selectedAsset.iv52wMax - selectedAsset.iv52wMin || 1)) * 100}`).join(' ')}
                          `}
                          fill={rec.vrp >= 0 ? '#10b981' : '#f43f5e'}
                          fillOpacity="0.12"
                        />

                        {/* Curva de IV 30d (Rosa) */}
                        <path
                          d={selectedAsset.ivHistory.map((val, idx) => {
                            const x = (idx / 5) * 320 + 10;
                            const y = 118 - ((val - selectedAsset.iv52wMin) / (selectedAsset.iv52wMax - selectedAsset.iv52wMin || 1)) * 100;
                            return `${idx === 0 ? 'M' : 'L'} ${x} ${Math.max(15, Math.min(120, y))}`;
                          }).join(' ')}
                          fill="none"
                          stroke="#f43f5e"
                          strokeWidth="2.8"
                          strokeLinecap="round"
                        />

                        {/* Curva de HV 20d (Ciano) */}
                        <path
                          d={selectedAsset.hvHistory.map((val, idx) => {
                            const x = (idx / 5) * 320 + 10;
                            const y = 118 - ((val - selectedAsset.iv52wMin) / (selectedAsset.iv52wMax - selectedAsset.iv52wMin || 1)) * 100;
                            return `${idx === 0 ? 'M' : 'L'} ${x} ${Math.max(15, Math.min(120, y))}`;
                          }).join(' ')}
                          fill="none"
                          stroke="#22d3ee"
                          strokeWidth="2.4"
                          strokeLinecap="round"
                        />

                        {/* Pontos nas Curvas */}
                        {selectedAsset.ivHistory.map((val, idx) => {
                          const x = (idx / 5) * 320 + 10;
                          const y = 118 - ((val - selectedAsset.iv52wMin) / (selectedAsset.iv52wMax - selectedAsset.iv52wMin || 1)) * 100;
                          return <circle key={`iv-${idx}`} cx={x} cy={Math.max(15, Math.min(120, y))} r="3" fill="#f43f5e" />;
                        })}
                        {selectedAsset.hvHistory.map((val, idx) => {
                          const x = (idx / 5) * 320 + 10;
                          const y = 118 - ((val - selectedAsset.iv52wMin) / (selectedAsset.iv52wMax - selectedAsset.iv52wMin || 1)) * 100;
                          return <circle key={`hv-${idx}`} cx={x} cy={Math.max(15, Math.min(120, y))} r="3" fill="#22d3ee" />;
                        })}
                      </svg>
                    </div>

                    <div className="flex justify-between text-[10px] font-mono text-gray-500 pt-2 border-t border-gray-800/80">
                      <span>Abril</span>
                      <span>Maio</span>
                      <span>Junho</span>
                      <span>Julho</span>
                      <span>Agosto</span>
                      <span className="text-white font-bold">Setembro (Atual)</span>
                    </div>
                  </div>

                  {/* Painel Lateral: Termômetro de IV RANK e Barra de IV PERCENTIL (4 colunas) */}
                  <div className="md:col-span-4 bg-[#070b14] border border-gray-800/90 rounded-xl p-3 flex flex-col justify-between space-y-3 font-mono">
                    
                    {/* 1. Medidor de IV RANK */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-400 font-bold">IV RANK (52s):</span>
                        <strong className={`text-sm ${selectedAsset.ivr >= 50 ? 'text-rose-400' : 'text-cyan-300'}`}>
                          {selectedAsset.ivr.toFixed(1)}%
                        </strong>
                      </div>

                      {/* Termômetro Vertical com Marcador */}
                      <div className="bg-[#0f172a] rounded-lg p-2 border border-gray-800/80">
                        <div className="flex justify-between text-[9px] text-gray-500 mb-1">
                          <span>0% (Mín)</span>
                          <span>50% (Neutro)</span>
                          <span>100% (Máx)</span>
                        </div>
                        <div className="h-3 w-full bg-gradient-to-r from-cyan-500 via-gray-600 to-rose-500 rounded-full relative overflow-hidden shadow-inner">
                          <div 
                            className="absolute top-0 bottom-0 w-2 bg-white rounded-full shadow-lg border border-black transform -translate-x-1"
                            style={{ left: `${Math.min(98, Math.max(2, selectedAsset.ivr))}%` }}
                          />
                        </div>
                        <p className="text-[9px] text-gray-400 mt-1.5 font-sans">
                          A IV atual está a <strong>{selectedAsset.ivr.toFixed(0)}%</strong> do caminho entre a mínima ({selectedAsset.iv52wMin.toFixed(0)}%) e a máxima ({selectedAsset.iv52wMax.toFixed(0)}%) do último ano.
                        </p>
                      </div>
                    </div>

                    {/* 2. Medidor de IV PERCENTIL */}
                    <div className="space-y-1.5 border-t border-gray-800 pt-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-400 font-bold">IV PERCENTIL:</span>
                        <strong className="text-sm text-purple-300 font-bold">
                          {selectedAsset.ivp.toFixed(0)}%
                        </strong>
                      </div>
                      <div className="w-full bg-gray-800 h-2.5 rounded-full overflow-hidden">
                        <div 
                          className="bg-purple-500 h-full rounded-full transition-all"
                          style={{ width: `${selectedAsset.ivp}%` }}
                        />
                      </div>
                      <p className="text-[9px] text-gray-400 font-sans">
                        Em <strong>{selectedAsset.ivp.toFixed(0)}%</strong> dos dias do ano, o mercado precificou oscilação menor que hoje.
                      </p>
                    </div>

                    {/* Veredito do Regime */}
                    <div className={`p-2 rounded-lg text-center text-[10px] font-bold border ${
                      selectedAsset.ivr >= 50 
                        ? 'bg-rose-500/15 text-rose-300 border-rose-500/30' 
                        : 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                    }`}>
                      {selectedAsset.ivr >= 50 ? '⚡ Venda de Seguro (Short Vega)' : '🎯 Compra de Seguro (Long Vega)'}
                    </div>

                  </div>

                </div>

                <p className="text-[10px] font-mono text-gray-400">
                  💡 <strong>Entenda a diferença:</strong> O <strong>IV Rank</strong> mede a distância matemática entre a máxima e a mínima do ano. O <strong>IV Percentil</strong> mede quantos dias do ano tiveram IV abaixo da atual (frequência). Quando ambos estão elevados, a seguradora tem vantagem estatística máxima.
                </p>
              </div>
            )}

            {/* Renderização do Gráfico 3: Volatility Smile & Skew por Strike */}
            {activeChartTab === 'VOL_SMILE' && (
              <div className="space-y-3">
                {/* Métricas do Smile */}
                <div className="flex flex-wrap items-center justify-between text-[11px] font-mono bg-[#070b14] p-2.5 rounded-xl border border-gray-800/80 gap-2">
                  <div className="flex items-center gap-3">
                    <span className="text-amber-400 font-bold flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5" />
                      25Δ Skew: +{selectedAsset.skew25?.toFixed(1) || '4.8'} pts
                    </span>
                    <span className="text-emerald-400 font-bold text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30">
                      PUT SKEW INSTITUCIONAL (Proteção de Cauda)
                    </span>
                  </div>
                  <div className="text-[10px] text-gray-300">
                    Spot ATM: <strong className="text-white">${selectedAsset.spot.toFixed(2)}</strong> @ <strong className="text-rose-400">{selectedAsset.iv30.toFixed(1)}% IV</strong>
                  </div>
                </div>

                {/* Gráfico do Smile em SVG */}
                <div className="h-52 w-full relative bg-[#070b14]/60 rounded-xl border border-gray-900 p-3">
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 520 140" preserveAspectRatio="none">
                    
                    {/* Linhas de Grade de IV */}
                    <line x1="30" y1="20" x2="490" y2="20" stroke="#1f293d" strokeDasharray="3 3" />
                    <line x1="30" y1="65" x2="490" y2="65" stroke="#1f293d" strokeDasharray="3 3" />
                    <line x1="30" y1="110" x2="490" y2="110" stroke="#1f293d" strokeDasharray="3 3" />

                    {/* Linha Vertical no Spot ATM */}
                    <line x1="260" y1="10" x2="260" y2="125" stroke="#ffffff" strokeDasharray="3 3" strokeWidth="1" opacity="0.5" />
                    <text x="264" y="18" fill="#ffffff" fontSize="8" fontFamily="JetBrains Mono" opacity="0.8">
                      ATM ${selectedAsset.spot.toFixed(0)}
                    </text>

                    {/* Linha Vertical na Put Wall */}
                    <line x1="140" y1="10" x2="140" y2="125" stroke="#f43f5e" strokeDasharray="3 3" strokeWidth="1.2" opacity="0.7" />
                    <text x="144" y="28" fill="#f43f5e" fontSize="8" fontFamily="JetBrains Mono">
                      Put Wall ${rec.putWall.toFixed(0)}
                    </text>

                    {/* Linha Vertical na Call Wall */}
                    <line x1="410" y1="10" x2="410" y2="125" stroke="#10b981" strokeDasharray="3 3" strokeWidth="1.2" opacity="0.7" />
                    <text x="414" y="28" fill="#10b981" fontSize="8" fontFamily="JetBrains Mono">
                      Call Wall ${rec.callWall.toFixed(0)}
                    </text>

                    {/* Área Preenchida abaixo da Curva do Smile */}
                    <polygon
                      points={`
                        30,125
                        ${rec.smileCurve.map((pt, idx) => {
                          const x = 30 + (idx / (rec.smileCurve.length - 1)) * 460;
                          const y = 120 - ((pt.iv - (selectedAsset.iv30 * 0.75)) / (selectedAsset.iv30 * 0.8)) * 90;
                          return `${x},${Math.max(15, Math.min(125, y))}`;
                        }).join(' ')}
                        490,125
                      `}
                      fill="#a855f7"
                      fillOpacity="0.08"
                    />

                    {/* Curva de Volatilidade (Smile / Skew) */}
                    <path
                      d={rec.smileCurve.map((pt, idx) => {
                        const x = 30 + (idx / (rec.smileCurve.length - 1)) * 460;
                        const y = 120 - ((pt.iv - (selectedAsset.iv30 * 0.75)) / (selectedAsset.iv30 * 0.8)) * 90;
                        return `${idx === 0 ? 'M' : 'L'} ${x} ${Math.max(15, Math.min(125, y))}`;
                      }).join(' ')}
                      fill="none"
                      stroke="#c084fc"
                      strokeWidth="2.8"
                      strokeLinecap="round"
                    />

                    {/* Pontos da Curva com Deltas */}
                    {rec.smileCurve.map((pt, idx) => {
                      const x = 30 + (idx / (rec.smileCurve.length - 1)) * 460;
                      const y = 120 - ((pt.iv - (selectedAsset.iv30 * 0.75)) / (selectedAsset.iv30 * 0.8)) * 90;
                      const clampedY = Math.max(15, Math.min(125, y));
                      const isAtm = pt.type === 'ATM';

                      return (
                        <g key={`smile-pt-${idx}`}>
                          <circle cx={x} cy={clampedY} r={isAtm ? 4.5 : 3} fill={isAtm ? '#ffffff' : '#c084fc'} />
                          {idx % 2 === 0 && (
                            <text x={x} y={clampedY - 7} fill="#94a3b8" fontSize="7" fontFamily="JetBrains Mono" textAnchor="middle">
                              {pt.iv.toFixed(1)}%
                            </text>
                          )}
                        </g>
                      );
                    })}

                    {/* Destaque das Pernas Recomendadas no Smile */}
                    {rec.legs.map((leg, lIdx) => {
                      const distMoneyness = leg.strike / selectedAsset.spot;
                      const normX = Math.max(0, Math.min(1, (distMoneyness - 0.85) / 0.30));
                      const x = 30 + normX * 460;
                      const y = 120 - ((leg.iv - (selectedAsset.iv30 * 0.75)) / (selectedAsset.iv30 * 0.8)) * 90;
                      const clampedY = Math.max(20, Math.min(120, y));
                      const isSell = leg.action === 'SELL';

                      return (
                        <g key={`leg-marker-${lIdx}`}>
                          <circle 
                            cx={x} 
                            cy={clampedY} 
                            r="6" 
                            fill={isSell ? '#f43f5e' : '#22d3ee'} 
                            stroke="#ffffff" 
                            strokeWidth="1.5" 
                          />
                          <text 
                            x={x} 
                            y={clampedY + (lIdx % 2 === 0 ? 16 : -10)} 
                            fill={isSell ? '#f43f5e' : '#22d3ee'} 
                            fontSize="8" 
                            fontFamily="JetBrains Mono" 
                            fontWeight="bold" 
                            textAnchor="middle"
                          >
                            {leg.action} ${leg.strike}
                          </text>
                        </g>
                      );
                    })}

                  </svg>
                </div>

                {/* Eixo X com Strikes e Deltas */}
                <div className="flex justify-between text-[10px] font-mono text-gray-400 px-3 border-t border-gray-800/80 pt-1.5">
                  <span className="text-cyan-300">10Δ Put (Tail)</span>
                  <span>25Δ Put</span>
                  <span className="text-white font-bold">50Δ ATM</span>
                  <span>25Δ Call</span>
                  <span className="text-emerald-300">10Δ Call</span>
                </div>

                <p className="text-[10px] font-mono text-gray-400">
                  🛡️ <strong>Leitura do Smile/Skew:</strong> No mercado acionário americano, a curva exibe uma inclinação acentuada para a esquerda (Put Skew). Os investidores institucionais pagam um prêmio de volatilidade expressivo por Puts OTM (seguro de queda). A estrutura eleita ({rec.strategy.name}) aproveita essa assimetria vendendo opções onde a volatilidade está cara e protegendo o spread.
                </p>
              </div>
            )}

          </div>

        </div>

        {/* COLUNA DIREITA: FICHA OPERACIONAL DO ATIVO SELECIONADO (5 colunas) */}
        <div className="lg:col-span-5 space-y-4">
          
          <div className="bg-[#0c1322] border border-purple-500/40 rounded-2xl p-5 shadow-2xl space-y-5 relative overflow-hidden">
            
            <div className="absolute -right-12 -top-12 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>

            {/* Cabeçalho do Ativo */}
            <div className="flex items-start justify-between border-b border-gray-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-black font-mono text-white">{selectedAsset.symbol}</h2>
                  <span className="text-xs text-gray-400 font-sans">{selectedAsset.name}</span>
                  <span className="px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono">Líquido 5/5</span>
                </div>
                <div className="flex flex-wrap items-center gap-3 font-mono text-xs mt-1">
                  <span>Spot: <strong className="text-white">${selectedAsset.spot.toFixed(2)}</strong></span>
                  <span className={`font-semibold ${selectedAsset.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {selectedAsset.change >= 0 ? '+' : ''}{selectedAsset.change.toFixed(2)}%
                  </span>
                  <span className="text-gray-500">|</span>
                  <span className="text-gray-400">SOFR: <strong className="text-gray-200">5.32%</strong></span>
                  <span className="text-gray-500">|</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold border ${
                    liveMetricsMap[selectedSymbol.toUpperCase()]?.source === 'tastytrade-live'
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                      : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                  }`}>
                    {liveMetricsMap[selectedSymbol.toUpperCase()]?.source === 'tastytrade-live'
                      ? 'Fonte: Tastytrade Live'
                      : 'Fonte: Modelo Calibrado'}
                  </span>
                </div>
              </div>

              <div className="text-right">
                <span className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold border ${
                  rec.gexRegime === '+GEX'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                }`}>
                  {rec.gexRegime === '+GEX' ? '+GEX ESTÁVEL' : '-GEX EXPLOSIVO'}
                </span>
                <div className="text-[10px] text-gray-400 font-mono mt-1">
                  {rec.gexRegime === '+GEX' ? 'Dealers Amortecem' : 'Dealers Aceleram'}
                </div>
              </div>
            </div>

            {/* Métricas Chave do Veredito (Com IV Rank, IV %, IV Percentil, VRP e Zero Gamma Flip) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-center font-mono text-xs">
              <div className="bg-[#070b14] p-2.5 rounded-xl border border-gray-800">
                <div className="text-[10px] text-gray-400">IV Rank (252d)</div>
                <div className={`text-base font-bold mt-0.5 ${selectedAsset.ivr >= 50 ? 'text-rose-400' : 'text-cyan-300'}`}>
                  {selectedAsset.ivr.toFixed(1)}%
                </div>
                <div className="text-[9px] text-gray-400">{selectedAsset.ivr >= 50 ? 'Prêmio Inflado' : 'Prêmio Barato'}</div>
              </div>

              <div className="bg-[#070b14] p-2.5 rounded-xl border border-gray-800">
                <div className="text-[10px] text-gray-400">IV % (Atual 30d)</div>
                <div className="text-base font-bold text-amber-300 mt-0.5">
                  {selectedAsset.iv30.toFixed(1)}%
                </div>
                <div className="text-[9px] text-gray-400">Vol Implícita ATM</div>
              </div>

              <div className="bg-[#070b14] p-2.5 rounded-xl border border-gray-800">
                <div className="text-[10px] text-gray-400">IV Percentil</div>
                <div className="text-base font-bold text-purple-300 mt-0.5">
                  {selectedAsset.ivp.toFixed(0)}%
                </div>
                <div className="text-[9px] text-gray-400">Freq. Histórica</div>
              </div>

              <div className="bg-[#070b14] p-2.5 rounded-xl border border-gray-800">
                <div className="text-[10px] text-gray-400">VRP (Prêmio Risco)</div>
                <div className={`text-base font-bold mt-0.5 ${rec.vrp >= 4 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {rec.vrp >= 0 ? '+' : ''}{rec.vrp.toFixed(1)} pts
                </div>
                <div className="text-[9px] text-gray-400">{rec.vrp >= 0 ? 'IV > RV Yang-Zhang' : 'IV < RV'}</div>
              </div>

              <div className="bg-[#070b14] p-2.5 rounded-xl border border-gray-800 col-span-2 sm:col-span-1">
                <div className="text-[10px] text-gray-400">Zero Gamma Flip</div>
                <div className="text-base font-bold text-cyan-300 mt-0.5">${rec.zeroGammaFlip.toFixed(2)}</div>
                <div className="text-[9px] text-gray-400">Divisor de Águas</div>
              </div>
            </div>

            {/* ESTRUTURA ELEITA CONFORME SKILL analista-senior-opcoes-us */}
            <div className="bg-gradient-to-b from-[#10192e] to-[#0a1020] border border-purple-500/30 rounded-xl p-4 space-y-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40">
                    <ShieldCheck className="w-4 h-4" />
                  </span>
                  <div>
                    <div className="text-[10px] font-mono text-purple-300 uppercase tracking-wide">Estratégia Recomendada</div>
                    <h3 className="text-sm font-bold font-mono text-white">{rec.strategy.name}</h3>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono text-[11px] font-bold">
                  {rec.targetDteLabel}
                </span>
              </div>

              {/* Lista de Pernas com Justificativa Resumida */}
              <div className="space-y-1.5 font-mono text-xs pt-1">
                {rec.legs.map((leg, idx) => (
                  <div key={idx} className="flex justify-between items-center p-2 rounded bg-[#070b14] border border-gray-800/80">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${leg.action === 'SELL' ? 'bg-rose-500/20 text-rose-300' : 'bg-cyan-500/20 text-cyan-300'}`}>
                        {leg.action}
                      </span>
                      <span className={leg.action === 'SELL' ? 'text-white font-bold' : 'text-gray-300'}>
                        {leg.type} ${leg.strike}
                      </span>
                    </div>
                    <span className="text-gray-400 text-[11px]">{leg.description}</span>
                    <span className={`font-bold ${leg.action === 'SELL' ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {leg.action === 'SELL' ? '+' : '-'}${leg.midPrice.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Payoff & Regra de Ouro do Crédito (§6.4) */}
              <div className="pt-2 border-t border-gray-800 flex justify-between items-center font-mono text-xs">
                <div>
                  <span className="text-gray-400">{rec.isCredit ? 'Crédito Líquido:' : 'Custo Líquido:'}</span>
                  <strong className={`font-bold text-sm ml-1 ${rec.isCredit ? 'text-emerald-400' : 'text-cyan-300'}`}>
                    ${Math.abs(rec.netCredit).toFixed(2)}
                  </strong>
                  {rec.isCredit && (
                    <span className="text-[10px] text-emerald-300/80 ml-1">
                      ({rec.meetsCreditRule ? 'Crédito ≥ 1/3: OK' : 'Alerta: Crédito < 1/3'})
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-gray-400">Prob. Lucro (POP):</span>
                  <strong className="text-cyan-300 font-bold ml-1">{rec.popEstimate}%</strong>
                </div>
              </div>
            </div>

            {/* BOTÃO PARA ABRIR O RACIONAL COMPLETO & JUSTIFICATIVA DIDÁTICA DOS STRIKES */}
            <button
              onClick={() => setShowDidacticModal(true)}
              className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-purple-900/40 via-purple-800/30 to-indigo-900/40 border border-purple-500/40 hover:border-purple-400 text-purple-200 hover:text-white font-mono text-xs font-bold transition flex items-center justify-between shadow-md"
            >
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-purple-400" />
                <span>Por que esta operação? (Justificativa de Cada Strike)</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40">
                Didático
              </span>
            </button>

            {/* PLAYBOOK MECÂNICO TASTYTRADE (§8 DA SKILL) */}
            <div className="bg-[#070b14] p-3.5 rounded-xl border border-gray-800 font-mono text-xs space-y-2">
              <div className="text-[10px] text-purple-300 font-bold uppercase flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Mecânica Operacional Tastytrade (Ciclo de Vida)
              </div>
              <ul className="text-[11px] text-gray-300 space-y-1.5 list-disc list-inside">
                <li>
                  <strong>Take Profit:</strong> Fechar a ordem com 50% do crédito recebido (<span className="text-emerald-400 font-bold">${rec.lifecycle.profitTargetDollar.toFixed(2)}</span>).
                </li>
                <li>
                  <strong>Gatilho de Defesa aos 21 DTE:</strong> Encerrar ou rolar para o ciclo seguinte para mitigar aceleração de Gamma e Zomma.
                </li>
                <li>
                  <strong>Untested Side:</strong> Rolar no máximo 1x por ciclo se uma asa for pressionada.
                </li>
                <li className={rec.lifecycle.hasDividendRisk ? 'text-rose-400 font-bold' : 'text-emerald-400'}>
                  <strong>Teste de Dividendo:</strong> {rec.lifecycle.dividendRiskReason}
                </li>
              </ul>
            </div>

            {/* Botões de Ação */}
            <div className="flex gap-2 font-mono text-xs pt-1">
              <button
                onClick={handleCopyOrder}
                className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold transition shadow-lg shadow-purple-600/25 flex items-center justify-center gap-2"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Ordem Copiada!' : 'Copiar Diagnóstico Completo'}</span>
              </button>
              {onNavigateToQuote && (
                <button
                  onClick={() => onNavigateToQuote(selectedAsset.symbol)}
                  className="px-4 py-2.5 rounded-xl bg-[#070b14] hover:bg-gray-800 text-gray-300 border border-gray-700 transition flex items-center justify-center gap-1.5 font-bold"
                  title="Ver Gráfico e Detalhes no Módulo Consulta"
                >
                  <span>Consulta</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

          </div>

        </div>

      </div>

      {/* ================= MODAL DIDÁTICO / EXPLICATIVO COMPLETO ================= */}
      {showDidacticModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto custom-scrollbar animate-in fade-in duration-200">
          <div className="bg-[#0c1322] border border-purple-500/50 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto custom-scrollbar shadow-2xl space-y-5 p-6 relative text-gray-200 font-sans">
            
            {/* Header do Modal */}
            <div className="flex items-start justify-between border-b border-gray-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-400">
                  <BookOpen className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-white font-mono">
                      O que faz o Analista Sênior de Opções — {selectedAsset.symbol}
                    </h2>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 font-mono font-bold">
                      Guia Didático
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 font-mono mt-0.5">
                    Explicação passo a passo para entender por que cada número e strike foi escolhido.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowDidacticModal(false)}
                className="p-1.5 rounded-lg bg-[#070b14] border border-gray-800 text-gray-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 1. Em uma frase */}
            <div className="bg-[#070b14] p-4 rounded-xl border border-purple-500/30 space-y-1 font-mono text-xs">
              <div className="text-[10px] uppercase text-purple-300 font-bold">Em Uma Frase</div>
              <p className="text-gray-200 leading-relaxed font-sans text-sm">
                &ldquo;{rationale.oneLiner}&rdquo;
              </p>
            </div>

            {/* 2. A Analogia do Seguro de Carro */}
            <div className="bg-[#10192e] p-4 rounded-xl border border-gray-800 space-y-2 text-xs">
              <div className="flex items-center gap-2 text-emerald-400 font-bold font-mono text-xs">
                <Shield className="w-4 h-4" />
                <span>A Analogia do Seguro de Carro</span>
              </div>
              <p className="text-gray-300 leading-relaxed font-sans">
                {rationale.carInsuranceAnalogy}
              </p>
              <p className="text-gray-400 leading-relaxed font-sans pt-1">
                Uma seguradora que cobra R$ 3.000 por ano num carro que quase nunca bate ganha dinheiro. Uma que cobra R$ 800 num carro que bate toda hora vai quebrar. Não importa o quanto ela gosta do carro — importa se o preço cobre o risco.
              </p>
            </div>

            {/* 3. Justificativa Detalhada Strike a Strike */}
            <div className="space-y-3 font-mono text-xs">
              <div className="flex items-center gap-2 text-purple-300 font-bold uppercase text-xs">
                <Target className="w-4 h-4" />
                <span>Por Que Cada Strike Foi Escolhido? (Ancoragem nas Walls)</span>
              </div>
              
              <div className="grid grid-cols-1 gap-2.5">
                {rationale.strikeByStrikeJustification.map((item, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-[#070b14] border border-gray-800 space-y-1">
                    <div className="flex justify-between items-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        item.action === 'SELL' ? 'bg-rose-500/20 text-rose-300' : 'bg-cyan-500/20 text-cyan-300'
                      }`}>
                        {item.action} {item.type} ${item.strike}
                      </span>
                      <span className="text-[11px] text-gray-400 font-semibold">{item.role}</span>
                    </div>
                    <p className="text-gray-300 font-sans text-xs leading-relaxed pt-1">
                      {item.reason}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* 4. As Quatro Perguntas Obrigatórias, Sempre em Dinheiro */}
            <div className="bg-[#10192e] border border-cyan-500/30 p-4 rounded-xl space-y-3 font-mono text-xs">
              <div className="flex items-center gap-2 text-cyan-300 font-bold uppercase text-xs">
                <Percent className="w-4 h-4" />
                <span>As Quatro Perguntas Obrigatórias — Sempre em Dinheiro ($)</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="bg-[#070b14] p-3 rounded-lg border border-gray-800 space-y-1">
                  <div className="text-gray-400 font-semibold text-[11px]">1. Quanto eu ganho no melhor cenário?</div>
                  <div className="text-emerald-400 font-bold font-mono text-xs">
                    {rationale.fourCashQuestions.maxProfitCash}
                  </div>
                </div>
                <div className="bg-[#070b14] p-3 rounded-lg border border-gray-800 space-y-1">
                  <div className="text-gray-400 font-semibold text-[11px]">2. Quanto eu perco no pior cenário? (A Pergunta Vital)</div>
                  <div className="text-rose-400 font-bold font-mono text-xs">
                    {rationale.fourCashQuestions.maxLossCash}
                  </div>
                </div>
                <div className="bg-[#070b14] p-3 rounded-lg border border-gray-800 space-y-1">
                  <div className="text-gray-400 font-semibold text-[11px]">3. A partir de que preço eu começo a perder?</div>
                  <div className="text-cyan-300 font-mono text-xs">
                    {rationale.fourCashQuestions.breakevenPoint}
                  </div>
                </div>
                <div className="bg-[#070b14] p-3 rounded-lg border border-gray-800 space-y-1">
                  <div className="text-gray-400 font-semibold text-[11px]">4. O que exatamente faz essa operação dar errado?</div>
                  <div className="text-amber-300 font-sans text-xs">
                    {rationale.fourCashQuestions.whatMakesItFail}
                  </div>
                </div>
              </div>
            </div>

            {/* 5. Os Quatro Trabalhos Executados */}
            <div className="space-y-2 font-mono text-xs">
              <div className="text-cyan-300 font-bold uppercase text-xs flex items-center gap-2">
                <Sliders className="w-4 h-4" />
                <span>Os Quatro Trabalhos que a Skill Executa</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-sans">
                <div className="bg-[#070b14] p-3 rounded-xl border border-gray-800">
                  <div className="font-bold text-white font-mono text-[11px]">1. Preço com Número, Não Opinião</div>
                  <p className="text-gray-400 text-xs mt-1">{rationale.fourJobsSummary.insurancePricing}</p>
                </div>
                <div className="bg-[#070b14] p-3 rounded-xl border border-gray-800">
                  <div className="font-bold text-white font-mono text-[11px]">2. A Estrutura Certa para o Cenário</div>
                  <p className="text-gray-400 text-xs mt-1">{rationale.fourJobsSummary.structureChoice}</p>
                </div>
                <div className="bg-[#070b14] p-3 rounded-xl border border-gray-800">
                  <div className="font-bold text-white font-mono text-[11px]">3. Risco Antes, Não Depois</div>
                  <p className="text-gray-400 text-xs mt-1">{rationale.fourJobsSummary.riskBeforeReward}</p>
                </div>
                <div className="bg-[#070b14] p-3 rounded-xl border border-gray-800">
                  <div className="font-bold text-white font-mono text-[11px]">4. Define Saída Antes de Entrar</div>
                  <p className="text-gray-400 text-xs mt-1">{rationale.fourJobsSummary.exitPlan}</p>
                </div>
              </div>
            </div>

            {/* 6. O que ela NÃO faz */}
            <div className="bg-rose-950/20 border border-rose-500/30 p-4 rounded-xl space-y-2 text-xs">
              <div className="text-rose-400 font-bold font-mono text-xs flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4" />
                <span>O Que a Skill NÃO Faz — Igualmente Importante</span>
              </div>
              <ul className="text-gray-300 space-y-1.5 list-disc list-inside font-sans">
                {rationale.whatItDoesNotDo.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>

            {/* 7. Por Que Isso Importa Para Quem Está Começando */}
            <div className="bg-[#070b14] border border-purple-500/30 p-4 rounded-xl space-y-2 font-mono text-xs">
              <div className="text-purple-300 font-bold uppercase text-xs flex items-center gap-1.5">
                <Compass className="w-4 h-4" />
                <span>Por Que Isso Importa Para Quem Está Começando</span>
              </div>
              <p className="text-gray-300 font-sans text-xs leading-relaxed">
                O mercado de opções é o lugar onde a diferença entre o investidor amador e o profissional é maior. Não porque o profissional acerte a direção toda vez — ele erra bastante. É porque ele:
              </p>
              <div className="space-y-1.5 pt-1">
                {rationale.whyItMattersForBeginners.map((point, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-gray-200 font-sans text-xs">
                    <span className="text-purple-400 font-bold font-mono">•</span>
                    <span>{point}</span>
                  </div>
                ))}
              </div>
              <p className="text-gray-400 font-sans text-[11px] pt-1">
                A ferramenta entrega essas três coisas de forma padronizada, sempre no mesmo formato, sem depender de como você está se sentindo naquele dia.
              </p>
            </div>

            {/* 8. Observação Honesta Sobre Expectativa */}
            <div className="bg-[#090d18] border border-amber-500/30 p-4 rounded-xl space-y-1.5 text-xs">
              <div className="text-amber-400 font-bold font-mono text-xs flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                <span>Uma Observação Honesta Sobre Expectativa</span>
              </div>
              <p className="text-gray-300 font-sans leading-relaxed text-xs">
                {rationale.honestExpectationNotice}
              </p>
            </div>

            {/* Footer com Botão de Fechar */}
            <div className="pt-2 border-t border-gray-800 flex justify-between items-center font-mono text-xs">
              <span className="text-gray-500 text-[10px]">{rationale.disclaimer}</span>
              <button
                onClick={() => setShowDidacticModal(false)}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold transition shadow-md"
              >
                Entendi, Voltar à Tela
              </button>
            </div>

          </div>
        </div>
      )}

    </section>
  );
}
