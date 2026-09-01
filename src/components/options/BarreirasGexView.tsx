'use client';

import React, { useState, useMemo } from 'react';
import { UnifiedGexBarreirasView } from './UnifiedGexBarreirasView';
import { US_STOCKS_DATASET } from '@/lib/domain/us-market-data';
import { Search } from 'lucide-react';

interface BarreirasGexViewProps {
  initialSymbol?: string;
  onSelectSymbol?: (sym: string) => void;
}

export function BarreirasGexView({ initialSymbol = 'NVDA', onSelectSymbol }: BarreirasGexViewProps) {
  const [selectedSymbol, setSelectedSymbol] = useState(initialSymbol || 'NVDA');
  const [searchInput, setSearchInput] = useState('');

  const currentStock = useMemo(() => {
    const found = US_STOCKS_DATASET.find(s => s.symbol === selectedSymbol.toUpperCase().trim());
    if (found) return found;
    return {
      symbol: selectedSymbol.toUpperCase().trim(),
      name: `${selectedSymbol.toUpperCase().trim()} Stock`,
      spot: 150.00,
    };
  }, [selectedSymbol]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      setSelectedSymbol(searchInput.trim().toUpperCase());
      onSelectSymbol?.(searchInput.trim().toUpperCase());
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Search & Symbol Selector Bar */}
      <div className="bg-[#0c1322] border border-gray-800 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
          <div className="relative w-72">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Buscar ativo (ex: NVDA, SPY, TSLA)..."
              className="w-full bg-[#070b14] border border-gray-700 rounded-lg pl-9 pr-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-cyan-500 uppercase"
            />
          </div>
          <button
            type="submit"
            className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-mono font-bold transition"
          >
            Consultar
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono">
          <span className="text-gray-400 mr-1">Atalhos:</span>
          {['NVDA', 'AAPL', 'MSFT', 'AMZN', 'META', 'TSLA', 'SPY', 'QQQ'].map(sym => (
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

      {/* Main Unified View Component */}
      <UnifiedGexBarreirasView symbol={currentStock.symbol} spotPrice={currentStock.spot} />
    </div>
  );
}