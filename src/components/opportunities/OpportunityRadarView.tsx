'use client';

import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Compass,
  Zap,
  Activity,
  Target,
  Search,
  Sparkles,
  Layers,
  ArrowUpRight,
  ShieldCheck,
} from 'lucide-react';
import { DataValue } from '@/components/shared/DataValue';

export interface OpportunityItem {
  id: string;
  symbol: string;
  name: string;
  strategyName: string;
  bias: 'ALTA' | 'BAIXA' | 'LATERAL';
  category: 'SHORT_PREMIUM' | 'LONG_VOL' | 'THE_WHEEL' | 'DIRECTIONAL';
  score: number;
  spotPrice: number;
  ivRank: number | null;
  ivPercentile: number | null;
  pop: number;
  expectedReturnPct: number;
  maxLoss: number;
  maxProfit: number;
  rationale: string;
  status: 'ALTA_CONVICCAO' | 'MODERADA' | 'NEUTRA';
}

interface OpportunityRadarViewProps {
  onSelectSymbol?: (symbol: string) => void;
}

const RAW_OPPORTUNITIES: OpportunityItem[] = [
    {
      id: '1',
      symbol: 'NVDA',
      name: 'NVIDIA Corp.',
      strategyName: 'Bull Put Spread 140/135',
      bias: 'ALTA',
      category: 'SHORT_PREMIUM',
      score: 88,
      spotPrice: 152.40,
      ivRank: 62.5,
      ivPercentile: 58.0,
      pop: 76.5,
      expectedReturnPct: 32.0,
      maxLoss: 375,
      maxProfit: 125,
      rationale: 'IV Rank elevado (>60%) favorece venda de volatilidade com asas protegidas abaixo do suporte.',
      status: 'ALTA_CONVICCAO',
    },
    {
      id: '2',
      symbol: 'SPY',
      name: 'SPDR S&P 500 ETF',
      strategyName: 'Iron Condor 540/535 - 580/585',
      bias: 'LATERAL',
      category: 'SHORT_PREMIUM',
      score: 82,
      spotPrice: 560.20,
      ivRank: 54.0,
      ivPercentile: 51.2,
      pop: 74.0,
      expectedReturnPct: 28.5,
      maxLoss: 360,
      maxProfit: 140,
      rationale: 'Lateralização em canal amplo; coleta de 1/3 da largura das asas com delta 0.16 bilateral.',
      status: 'ALTA_CONVICCAO',
    },
    {
      id: '3',
      symbol: 'TSLA',
      name: 'Tesla Inc.',
      strategyName: 'Cash-Secured Put $210 (The Wheel)',
      bias: 'ALTA',
      category: 'THE_WHEEL',
      score: 79,
      spotPrice: 228.50,
      ivRank: 68.0,
      ivPercentile: 65.4,
      pop: 78.0,
      expectedReturnPct: 22.4,
      maxLoss: 21000,
      maxProfit: 540,
      rationale: 'Prêmio gordo de volatilidade implícita permitindo entrada na ação com desconto real.',
      status: 'ALTA_CONVICCAO',
    },
    {
      id: '4',
      symbol: 'AAPL',
      name: 'Apple Inc.',
      strategyName: 'Bull Call Debit Spread 220/230',
      bias: 'ALTA',
      category: 'LONG_VOL',
      score: 75,
      spotPrice: 224.10,
      ivRank: 22.0,
      ivPercentile: 24.5,
      pop: 56.0,
      expectedReturnPct: 65.0,
      maxLoss: 420,
      maxProfit: 580,
      rationale: 'IV Rank baixo (<25%) torna compra de opções barata para capturar momentum.',
      status: 'MODERADA',
    },
    {
      id: '5',
      symbol: 'MSFT',
      name: 'Microsoft Corp.',
      strategyName: 'Covered Call $435',
      bias: 'ALTA',
      category: 'DIRECTIONAL',
      score: 74,
      spotPrice: 422.80,
      ivRank: 34.0,
      ivPercentile: 32.0,
      pop: 71.0,
      expectedReturnPct: 18.0,
      maxLoss: 42280,
      maxProfit: 1850,
      rationale: 'Venda de Call OTM delta 0.28 monetizando carteira de ações com rendimento excedente.',
      status: 'MODERADA',
    },
    {
      id: '6',
      symbol: 'QQQ',
      name: 'Invesco QQQ Trust',
      strategyName: 'Bull Put Spread 475/470',
      bias: 'ALTA',
      category: 'SHORT_PREMIUM',
      score: 80,
      spotPrice: 492.30,
      ivRank: 51.5,
      ivPercentile: 49.0,
      pop: 75.0,
      expectedReturnPct: 30.0,
      maxLoss: 380,
      maxProfit: 120,
      rationale: 'Suporte institucional sólido no índice de tecnologia e prêmio atrativo de crédito.',
      status: 'ALTA_CONVICCAO',
    },
  ];

export const OpportunityRadarView: React.FC<OpportunityRadarViewProps> = ({ onSelectSymbol }) => {
  const [minScore, setMinScore] = useState<number>(70);
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  const filteredOpportunities = useMemo(() => {
    return RAW_OPPORTUNITIES.filter((item) => {
      if (item.score < minScore) return false;
      if (selectedCategory !== 'ALL' && item.category !== selectedCategory) return false;
      if (searchFilter.trim()) {
        const query = searchFilter.trim().toUpperCase();
        return item.symbol.includes(query) || item.name.toUpperCase().includes(query);
      }
      return true;
    });
  }, [minScore, selectedCategory, searchFilter]);

  const oppProv = 'ESTIMADO';
  const oppSource = 'Algoritmo de triagem quantitativa de opções US';

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Barra de Filtros Superior */}
      <div className="bg-[#0c121e] border border-gray-800 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <Target className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">
              <span>Radar de Oportunidades Quantitativas</span>
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-bold">
                {/* eslint-disable-next-line local-rules/no-raw-numbers-in-jsx -- contagem visual de itens */}
                {filteredOpportunities.length} SETUPS FILTRADOS
              </span>
            </h2>
            <p className="text-xs text-gray-400 font-mono">
              Triagem algorítmica de assimetrias de volatilidade e crédito em opções dos EUA
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-[#070b14] border border-gray-800 px-3 py-1.5 rounded-xl text-xs font-mono">
            <span className="text-gray-400">Score Mín:</span>
            <select
              value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value))}
              className="bg-transparent text-emerald-400 font-bold focus:outline-none cursor-pointer"
            >
              <option value={60} className="bg-gray-900 text-white">60+</option>
              <option value={70} className="bg-gray-900 text-white">70+ (Recomendado)</option>
              <option value={80} className="bg-gray-900 text-white">80+ (Alta Convicção)</option>
            </select>
          </div>

          <div className="relative w-40 sm:w-48">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value.toUpperCase())}
              placeholder="Buscar ticker..."
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-[#070b14] border border-gray-800 text-xs text-white font-mono placeholder-gray-500 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* Categorias */}
      <div className="flex flex-wrap items-center gap-2 bg-[#0b101b] border border-gray-800 p-2 rounded-2xl">
        {[
          { id: 'ALL', label: 'Todas as Oportunidades' },
          { id: 'SHORT_PREMIUM', label: 'Short Premium (Alto IV Rank)' },
          { id: 'THE_WHEEL', label: 'The Wheel (Cash-Secured Put)' },
          { id: 'LONG_VOL', label: 'Long Volatility (Baixo IV Rank)' },
          { id: 'DIRECTIONAL', label: 'Direcional / Covered Call' },
        ].map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-3.5 py-2 rounded-xl text-xs font-mono font-bold transition border ${
              selectedCategory === cat.id
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-md'
                : 'bg-[#070b14] text-gray-400 border-gray-800 hover:text-white'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Grid de Cards de Oportunidades */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredOpportunities.map((opp) => (
          <div
            key={opp.id}
            className="group relative flex flex-col justify-between rounded-2xl border border-gray-800 bg-[#0c121e] hover:bg-[#0f1726] p-5 transition-all duration-300 hover:border-emerald-500/50 hover:shadow-xl hover:shadow-emerald-500/5"
          >
            <div>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-black text-white font-mono">{opp.symbol}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        opp.bias === 'ALTA'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : opp.bias === 'BAIXA'
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                          : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                      }`}
                    >
                      {opp.bias}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400 block truncate">{opp.name}</span>
                </div>

                <div className="text-right">
                  <DataValue
                    value={opp.score}
                    format="number"
                    provenance={oppProv}
                    source={oppSource}
                    className="text-lg font-black font-mono text-emerald-400 block"
                  />
                  <span className="text-[10px] text-gray-500 font-mono">SCORE</span>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-[#070b14] border border-gray-800/80 mb-3">
                <span className="text-xs font-bold text-white font-mono block">
                  {opp.strategyName}
                </span>
                <span className="text-[11px] text-gray-400 font-mono">
                  POP: <DataValue variant="inline" value={opp.pop} format="percent" provenance={oppProv} source={oppSource} className="text-emerald-300 font-bold" /> • Retorno: <DataValue variant="inline" value={opp.expectedReturnPct} format="percent" provenance={oppProv} source={oppSource} className="text-cyan-300 font-bold" />
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono mb-3">
                <div className="p-2 rounded-lg bg-gray-900/50 border border-gray-800/60">
                  <span className="text-[10px] text-gray-500 block">Spot Atual</span>
                  <DataValue value={opp.spotPrice} format="currency" provenance="ESTIMADO" source="Catálogo de referência US" className="font-bold text-white" />
                </div>
                <div className="p-2 rounded-lg bg-gray-900/50 border border-gray-800/60">
                  <span className="text-[10px] text-gray-500 block">IV Rank</span>
                  <DataValue value={opp.ivRank} format="percent" provenance="ESTIMADO" source="Métrica histórica de volatilidade" className="font-bold text-emerald-400" />
                </div>
              </div>

              <p className="text-xs text-gray-400 leading-relaxed font-sans mb-4">
                {opp.rationale}
              </p>
            </div>

            <button
              type="button"
              onClick={() => onSelectSymbol?.(opp.symbol)}
              className="w-full py-2 px-3 rounded-xl bg-gray-800/70 group-hover:bg-emerald-500 group-hover:text-slate-950 text-gray-200 font-bold text-xs font-mono flex items-center justify-center gap-1.5 transition border border-gray-700/60 group-hover:border-emerald-400 shadow-sm"
            >
              <span>Analisar Raio-X ({opp.symbol})</span>
              <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
