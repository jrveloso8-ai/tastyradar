'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { UnifiedGexBarreirasView } from './UnifiedGexBarreirasView';
import { OptionsStrategyEngineView } from './OptionsStrategyEngineView';
import { OptionsTop10View } from './OptionsTop10View';
import { OptionsTracking5DView } from './OptionsTracking5DView';
import { US_STOCKS_DATASET } from '@/lib/domain/us-market-data';
import { Search, ArrowLeft, TrendingUp, Target, SlidersHorizontal, BarChart2, Activity } from 'lucide-react';

interface BarreirasGexViewProps {
  initialSymbol?: string;
  onSelectSymbol?: (sym: string) => void;
  onBackToQuote?: (sym: string) => void;
  onBackToScreener?: () => void;
}

export type OptionsSubTab = 'GEX' | 'STRATEGIES' | 'TOP10' | 'TRACKING_5D';

export function BarreirasGexView({ 
  initialSymbol = 'NVDA', 
  onSelectSymbol,
  onBackToQuote,
  onBackToScreener
}: BarreirasGexViewProps) {
  const [selectedSymbol, setSelectedSymbol] = useState(initialSymbol || 'NVDA');
  const [activeSubTab, setActiveSubTab] = useState<OptionsSubTab>('GEX');
  const [searchInput, setSearchInput] = useState('');
  const [liveEquity, setLiveEquity] = useState<{ last: number | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const cleanSym = selectedSymbol.toUpperCase().trim();
    fetch(`/api/market/equity-quotes?symbol=${encodeURIComponent(cleanSym)}`)
      .then((r) => r.json())
      .then((res) => {
        if (cancelled) return;
        const q = res?.data?.[cleanSym];
        if (q && typeof q.last === 'number') {
          setLiveEquity(q);
        } else {
          setLiveEquity(null);
        }
      })
      .catch(() => {
        if (!cancelled) setLiveEquity(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedSymbol]);

  const currentStock = useMemo(() => {
    const found = US_STOCKS_DATASET.find(s => s.symbol === selectedSymbol.toUpperCase().trim());
    if (found) return found;
    return {
      symbol: selectedSymbol.toUpperCase().trim(),
      name: `${selectedSymbol.toUpperCase().trim()} Stock`,
      spot: 150.00,
    };
  }, [selectedSymbol]);

  const activeSpot = liveEquity?.last ?? currentStock.spot;

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      const clean = searchInput.trim().toUpperCase();
      setSelectedSymbol(clean);
      onSelectSymbol?.(clean);
    }
  };

  return (
    <div className="space-y-6">
      {/* Navigation & Search Bar */}
      <div className="bg-[#0c1322] border border-gray-800 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          {onBackToQuote && (
            <button
              onClick={() => onBackToQuote(selectedSymbol)}
              className="px-3.5 py-1.5 bg-[#070b14] hover:bg-gray-800 text-cyan-400 border border-cyan-500/30 rounded-xl text-xs font-mono font-bold transition flex items-center gap-1.5 shadow-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar para Consulta ({selectedSymbol})</span>
            </button>
          )}

          {onBackToScreener && (
            <button
              onClick={onBackToScreener}
              className="px-3.5 py-1.5 bg-[#070b14] hover:bg-gray-800 text-gray-300 border border-gray-800 rounded-xl text-xs font-mono transition flex items-center gap-1.5"
            >
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              <span>Rastreador</span>
            </button>
          )}
        </div>

        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
          <div className="relative w-64">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Buscar ativo (ex: NVDA, SPY)..."
              className="w-full bg-[#070b14] border border-gray-700 rounded-lg pl-9 pr-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-cyan-500 uppercase"
            />
          </div>
          <button
            type="submit"
            className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-mono font-bold transition"
          >
            Buscar
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono">
          <span className="text-gray-400 mr-1">Atalhos:</span>
          {['NVDA', 'AAPL', 'MSFT', 'AMZN', 'META', 'TSLA', 'SPY', 'QQQ', 'KO'].map(sym => (
            <button
              key={sym}
              onClick={() => {
                setSelectedSymbol(sym);
                onSelectSymbol?.(sym);
              }}
              className={`px-2.5 py-1 rounded-lg transition ${
                selectedSymbol === sym
                  ? 'bg-cyan-500 text-slate-950 font-black'
                  : 'bg-[#070b14] text-gray-400 hover:text-white border border-gray-800'
              }`}
            >
              {sym}
            </button>
          ))}
        </div>
      </div>

      {/* Subabas do Módulo de Opções & Derivativos */}
      <div className="flex flex-wrap items-center gap-2 bg-[#090e18] border border-gray-800/90 p-2 rounded-2xl shadow-lg">
        {[
          { id: 'GEX' as const, label: '1. Barreiras & Motor GEX', icon: Target },
          { id: 'STRATEGIES' as const, label: '2. Motor de Estratégias & Payoff', icon: SlidersHorizontal },
          { id: 'TOP10' as const, label: '3. Top 10 Concentração (OI)', icon: BarChart2 },
          { id: 'TRACKING_5D' as const, label: '4. Rastreamento 5D', icon: Activity },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono text-xs font-bold transition border ${
                isActive
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-md shadow-cyan-500/10'
                  : 'bg-[#070b14] text-gray-400 border-gray-800 hover:text-white hover:border-gray-700'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-gray-500'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Renderização Condicional das Subabas */}
      {activeSubTab === 'GEX' && (
        <UnifiedGexBarreirasView 
          symbol={currentStock.symbol} 
          spotPrice={activeSpot} 
          onBackToQuote={onBackToQuote}
          onBackToScreener={onBackToScreener}
        />
      )}

      {activeSubTab === 'STRATEGIES' && (
        <OptionsStrategyEngineView
          initialSymbol={selectedSymbol}
          onSelectSymbol={(sym) => setSelectedSymbol(sym)}
        />
      )}

      {activeSubTab === 'TOP10' && (
        <OptionsTop10View
          initialSymbol={selectedSymbol}
          onSelectSymbol={(sym) => setSelectedSymbol(sym)}
        />
      )}

      {activeSubTab === 'TRACKING_5D' && (
        <OptionsTracking5DView
          initialSymbol={selectedSymbol}
          onSelectSymbol={(sym) => setSelectedSymbol(sym)}
        />
      )}
    </div>
  );
}