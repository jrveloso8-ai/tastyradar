'use client';

import React, { useState, useMemo } from 'react';
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
  Sparkles
} from 'lucide-react';
import { volatilityEngine, VolatilityAssetInput, VolatilityRecommendation } from '@/lib/domain/volatility-engine';
import { generateCandlesticks, CandleDataPoint } from '@/lib/domain/us-market-data';

interface VolatilityAnalystViewProps {
  onNavigateToQuote?: (symbol: string) => void;
  onNavigateToGex?: (symbol: string) => void;
}

interface AssetDatasetItem extends VolatilityAssetInput {
  hvHistory: number[];
  ivHistory: number[];
  iv52wMin: number;
  iv52wMax: number;
}

const DEFAULT_ASSETS: AssetDatasetItem[] = [
  {
    symbol: 'NVDA',
    name: 'NVIDIA Corporation',
    spot: 142.50,
    change: 2.84,
    ivr: 74.2,
    ivp: 81.0,
    iv30: 44.5,
    rv20: 32.1,
    skew25: 4.8,
    netGex: 120.5,
    zeroGammaFlip: 138.00,
    putWall: 135.00,
    callWall: 155.00,
    dividendAmount: 0.04,
    callExtrinsic: 1.35,
    iv52wMin: 26.0,
    iv52wMax: 51.0,
    hvHistory: [38, 35, 33, 31, 32, 32.1],
    ivHistory: [52, 48, 46, 43, 45, 44.5],
  },
  {
    symbol: 'TSLA',
    name: 'Tesla Inc.',
    spot: 248.30,
    change: -1.15,
    ivr: 22.4,
    ivp: 26.0,
    iv30: 36.2,
    rv20: 39.4,
    skew25: 5.5,
    netGex: -45.0,
    zeroGammaFlip: 252.00,
    putWall: 235.00,
    callWall: 265.00,
    dividendAmount: 0.00,
    callExtrinsic: 2.10,
    iv52wMin: 31.0,
    iv52wMax: 54.0,
    hvHistory: [44, 42, 41, 40, 39, 39.4],
    ivHistory: [41, 38, 36, 35, 36, 36.2],
  },
  {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    spot: 238.10,
    change: 0.65,
    ivr: 68.0,
    ivp: 72.0,
    iv30: 24.5,
    rv20: 16.2,
    skew25: 4.2,
    netGex: 85.0,
    zeroGammaFlip: 234.00,
    putWall: 230.00,
    callWall: 245.00,
    dividendAmount: 0.25,
    callExtrinsic: 1.15,
    iv52wMin: 16.0,
    iv52wMax: 28.5,
    hvHistory: [18, 17, 17, 16, 16, 16.2],
    ivHistory: [28, 26, 25, 24, 25, 24.5],
  },
  {
    symbol: 'SPY',
    name: 'SPDR S&P 500 ETF Trust',
    spot: 598.80,
    change: 0.78,
    ivr: 18.5,
    ivp: 21.0,
    iv30: 13.2,
    rv20: 11.5,
    skew25: 6.8,
    netGex: 450.0,
    zeroGammaFlip: 592.00,
    putWall: 590.00,
    callWall: 605.00,
    dividendAmount: 1.85,
    callExtrinsic: 2.80,
    iv52wMin: 11.5,
    iv52wMax: 20.7,
    hvHistory: [12, 11.8, 11.6, 11.5, 11.5, 11.5],
    ivHistory: [15, 14.5, 14, 13.5, 13.4, 13.2],
  },
  {
    symbol: 'QQQ',
    name: 'Invesco QQQ Trust',
    spot: 518.20,
    change: 1.22,
    ivr: 24.0,
    ivp: 28.0,
    iv30: 18.4,
    rv20: 17.1,
    skew25: 6.2,
    netGex: 210.0,
    zeroGammaFlip: 512.00,
    putWall: 510.00,
    callWall: 525.00,
    dividendAmount: 0.75,
    callExtrinsic: 2.40,
    iv52wMin: 15.0,
    iv52wMax: 29.2,
    hvHistory: [18, 17.5, 17.2, 17.0, 17.1, 17.1],
    ivHistory: [21, 20.2, 19.5, 18.8, 18.6, 18.4],
  },
  {
    symbol: 'META',
    name: 'Meta Platforms Inc.',
    spot: 612.40,
    change: 1.45,
    ivr: 71.5,
    ivp: 78.0,
    iv30: 38.0,
    rv20: 27.5,
    skew25: 4.5,
    netGex: 95.0,
    zeroGammaFlip: 600.00,
    putWall: 590.00,
    callWall: 630.00,
    dividendAmount: 0.50,
    callExtrinsic: 3.10,
    iv52wMin: 24.0,
    iv52wMax: 43.6,
    hvHistory: [32, 30, 29, 28, 27.8, 27.5],
    ivHistory: [44, 42, 40, 39, 38.5, 38.0],
  },
  {
    symbol: 'AMD',
    name: 'Advanced Micro Devices',
    spot: 156.80,
    change: 3.12,
    ivr: 62.0,
    ivp: 66.0,
    iv30: 48.0,
    rv20: 39.2,
    skew25: 4.9,
    netGex: 45.0,
    zeroGammaFlip: 152.00,
    putWall: 148.00,
    callWall: 165.00,
    dividendAmount: 0.00,
    callExtrinsic: 2.45,
    iv52wMin: 33.0,
    iv52wMax: 57.2,
    hvHistory: [42, 41, 40, 39.5, 39.3, 39.2],
    ivHistory: [55, 52, 50, 49, 48.5, 48.0],
  },
  {
    symbol: 'AMZN',
    name: 'Amazon.com Inc.',
    spot: 198.40,
    change: -0.42,
    ivr: 42.0,
    ivp: 45.0,
    iv30: 29.5,
    rv20: 26.8,
    skew25: 4.4,
    netGex: 60.0,
    zeroGammaFlip: 195.00,
    putWall: 190.00,
    callWall: 205.00,
    dividendAmount: 0.00,
    callExtrinsic: 1.80,
    iv52wMin: 22.0,
    iv52wMax: 39.8,
    hvHistory: [28, 27.5, 27.1, 26.9, 26.8, 26.8],
    ivHistory: [33, 32, 31, 30.2, 29.8, 29.5],
  },
  {
    symbol: 'MSFT',
    name: 'Microsoft Corporation',
    spot: 432.10,
    change: 0.35,
    ivr: 54.0,
    ivp: 58.0,
    iv30: 22.0,
    rv20: 17.5,
    skew25: 4.1,
    netGex: 140.0,
    zeroGammaFlip: 428.00,
    putWall: 425.00,
    callWall: 440.00,
    dividendAmount: 0.83,
    callExtrinsic: 1.95,
    iv52wMin: 16.5,
    iv52wMax: 26.7,
    hvHistory: [20, 19, 18.5, 18, 17.6, 17.5],
    ivHistory: [26, 25, 24, 23, 22.5, 22.0],
  },
  {
    symbol: 'IWM',
    name: 'iShares Russell 2000 ETF',
    spot: 224.50,
    change: -0.85,
    ivr: 31.0,
    ivp: 35.0,
    iv30: 21.5,
    rv20: 20.8,
    skew25: 5.8,
    netGex: -30.0,
    zeroGammaFlip: 226.00,
    putWall: 220.00,
    callWall: 230.00,
    dividendAmount: 0.70,
    callExtrinsic: 1.40,
    iv52wMin: 17.0,
    iv52wMax: 31.5,
    hvHistory: [22, 21.5, 21.2, 21.0, 20.9, 20.8],
    ivHistory: [24, 23.2, 22.5, 22.0, 21.8, 21.5],
  }
];

export function VolatilityAnalystView({ onNavigateToQuote, onNavigateToGex }: VolatilityAnalystViewProps) {
  const [selectedSymbol, setSelectedSymbol] = useState<string>('NVDA');
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'SELL_VOL' | 'BUY_VOL' | 'WALL_SNIPER'>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [activeChartTab, setActiveChartTab] = useState<'PRICE_OI' | 'VOL_HISTORIC' | 'VOL_SMILE'>('PRICE_OI');
  const [showDidacticModal, setShowDidacticModal] = useState<boolean>(false);

  // Avaliação do motor para cada ativo
  const evaluatedAssets = useMemo(() => {
    return DEFAULT_ASSETS.map(asset => {
      const evaluation = volatilityEngine.evaluate(asset);
      return {
        ...asset,
        evaluation
      };
    });
  }, []);

  // Lista filtrada
  const filteredAssets = useMemo(() => {
    return evaluatedAssets.filter(item => {
      if (searchTerm.trim()) {
        const q = searchTerm.trim().toUpperCase();
        if (!item.symbol.includes(q) && !item.name.toUpperCase().includes(q)) {
          return false;
        }
      }
      if (activeFilter === 'SELL_VOL') return item.ivr >= 50;
      if (activeFilter === 'BUY_VOL') return item.ivr < 35;
      if (activeFilter === 'WALL_SNIPER') {
        const distToPut = Math.abs(item.spot - item.putWall) / item.spot;
        const distToCall = Math.abs(item.spot - item.callWall) / item.spot;
        return distToPut < 0.03 || distToCall < 0.03;
      }
      return true;
    });
  }, [evaluatedAssets, activeFilter, searchTerm]);

  // Ativo atualmente selecionado
  const selectedAsset = useMemo(() => {
    return evaluatedAssets.find(a => a.symbol === selectedSymbol) || evaluatedAssets[0];
  }, [evaluatedAssets, selectedSymbol]);

  const rec = selectedAsset.evaluation;
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
      
      {/* 1. BARRA MACRO DO MERCADO AMERICANO (§5.2 da skill) */}
      <div className="bg-[#0c1322] border border-gray-800/90 rounded-2xl p-4 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-400 shadow-sm">
              <Gauge className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold text-white font-mono tracking-tight">
                  Analista de Volatilidade & Riscos Institucionais
                </h1>
                <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 font-mono font-bold">
                  SKILL: analista-senior-opcoes-us
                </span>
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
                  onClick={() => setActiveFilter('ALL')}
                  className={`px-3 py-1 rounded-lg transition font-bold ${
                    activeFilter === 'ALL'
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Todos ({evaluatedAssets.length})
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

              <div className="relative w-44">
                <Search className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-2" />
                <input 
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar ticker..."
                  className="w-full bg-[#070b14] border border-gray-800 rounded-lg pl-8 pr-2 py-1 text-xs font-mono text-white focus:outline-none focus:border-purple-500 uppercase"
                />
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
                <div className="flex items-center gap-3 font-mono text-xs mt-1">
                  <span>Spot: <strong className="text-white">${selectedAsset.spot.toFixed(2)}</strong></span>
                  <span className={`font-semibold ${selectedAsset.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {selectedAsset.change >= 0 ? '+' : ''}{selectedAsset.change.toFixed(2)}%
                  </span>
                  <span className="text-gray-500">|</span>
                  <span className="text-gray-400">SOFR: <strong className="text-gray-200">5.32%</strong></span>
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

            {/* Métricas Chave do Veredito */}
            <div className="grid grid-cols-3 gap-2 text-center font-mono text-xs">
              <div className="bg-[#070b14] p-2.5 rounded-xl border border-gray-800">
                <div className="text-[10px] text-gray-400">IV Rank (252d)</div>
                <div className={`text-base font-bold mt-0.5 ${rec.ivr >= 50 ? 'text-rose-400' : 'text-cyan-300'}`}>
                  {rec.ivr.toFixed(1)}%
                </div>
                <div className="text-[9px] text-gray-400">{rec.ivr >= 50 ? 'Prêmio Inflado' : 'Prêmio Barato'}</div>
              </div>
              <div className="bg-[#070b14] p-2.5 rounded-xl border border-gray-800">
                <div className="text-[10px] text-gray-400">VRP (Prêmio Risco)</div>
                <div className={`text-base font-bold mt-0.5 ${rec.vrp >= 4 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {rec.vrp >= 0 ? '+' : ''}{rec.vrp.toFixed(1)} pts
                </div>
                <div className="text-[9px] text-gray-400">{rec.vrp >= 0 ? 'IV > RV Yang-Zhang' : 'IV < RV'}</div>
              </div>
              <div className="bg-[#070b14] p-2.5 rounded-xl border border-gray-800">
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
                "{rationale.oneLiner}"
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
