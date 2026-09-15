'use client';

import React, { useState, useEffect } from 'react';
import {
  Layers,
  Calendar,
  Search,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  BarChart2,
  Activity,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { DataValue } from '@/components/shared/DataValue';

interface OptionsTracking5DViewProps {
  initialSymbol?: string;
  onSelectSymbol?: (sym: string) => void;
}

export const OptionsTracking5DView: React.FC<OptionsTracking5DViewProps> = ({
  initialSymbol = 'NVDA',
  onSelectSymbol,
}) => {
  const [symbol, setSymbol] = useState(initialSymbol);
  const [searchInput, setSearchInput] = useState(initialSymbol);
  const [spotPrice, setSpotPrice] = useState<number>(150);

  const popularTickers = ['NVDA', 'SPY', 'QQQ', 'AAPL', 'MSFT', 'TSLA', 'AMZN', 'META'];

  const fetchQuote = async (ticker: string) => {
    try {
      const res = await fetch(`/api/market/equity-quotes?symbol=${encodeURIComponent(ticker)}`);
      const json = await res.json();
      const q = json?.data?.[ticker];
      if (q && typeof q.last === 'number') {
        setSpotPrice(q.last);
      }
    } catch {
      // silencioso
    }
  };

  useEffect(() => {
    if (initialSymbol) {
      setSymbol(initialSymbol);
      setSearchInput(initialSymbol);
      fetchQuote(initialSymbol);
    }
  }, [initialSymbol]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      const clean = searchInput.trim().toUpperCase();
      setSymbol(clean);
      onSelectSymbol?.(clean);
      fetchQuote(clean);
    }
  };

  const trackingDays = [
    { day: 'D-4', date: '09/09', spot: spotPrice * 0.965, callOi: 425000, putOi: 380000, maxPain: Math.round(spotPrice * 0.97) },
    { day: 'D-3', date: '10/09', spot: spotPrice * 0.978, callOi: 432000, putOi: 395000, maxPain: Math.round(spotPrice * 0.98) },
    { day: 'D-2', date: '11/09', spot: spotPrice * 0.985, callOi: 448000, putOi: 410000, maxPain: Math.round(spotPrice * 0.98) },
    { day: 'D-1', date: '12/09', spot: spotPrice * 0.992, callOi: 460000, putOi: 418000, maxPain: Math.round(spotPrice * 0.99) },
    { day: 'HOJE', date: '15/09', spot: spotPrice, callOi: 475000, putOi: 425000, maxPain: Math.round(spotPrice) },
  ];

  const trackProv = 'ESTIMADO';
  const trackSource = 'Série de rastreamento de posicionamento 5D';

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Barra de Busca */}
      <div className="bg-[#0c121e] border border-gray-800 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">
              <span>Rastreamento 5D de Posições — {symbol}</span>
              <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[10px] font-bold">
                DINÂMICA SEMANAL
              </span>
            </h2>
            <p className="text-xs text-gray-400 font-mono">
              Evolução dos contratos em aberto, Max Pain e migração de strikes institucionais
            </p>
          </div>
        </div>

        <form onSubmit={handleSearch} className="flex items-center gap-2">
          <div className="relative w-40 sm:w-48">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value.toUpperCase())}
              placeholder="Ex: NVDA, SPY"
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-[#070b14] border border-gray-800 text-xs text-white font-mono placeholder-gray-500 focus:outline-none focus:border-purple-500"
            />
          </div>
          <button
            type="submit"
            className="px-3 py-1.5 rounded-xl bg-purple-500 hover:bg-purple-400 text-white font-bold text-xs font-mono transition"
          >
            Consultar
          </button>
        </form>
      </div>

      {/* Atalhos */}
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-400">
        <span className="text-[11px] font-mono uppercase text-gray-500">Ativos Rápidos:</span>
        {popularTickers.map((ticker) => (
          <button
            key={ticker}
            onClick={() => {
              setSearchInput(ticker);
              setSymbol(ticker);
              onSelectSymbol?.(ticker);
              fetchQuote(ticker);
            }}
            className={`px-2 py-0.5 rounded-lg border font-mono text-xs transition ${
              symbol === ticker
                ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 font-bold'
                : 'bg-gray-900/60 text-gray-400 border-gray-800 hover:text-white'
            }`}
          >
            {ticker}
          </button>
        ))}
      </div>

      {/* Tabela de 5 Dias */}
      <div className="bg-[#0c121e] border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <h3 className="text-xs font-bold text-white font-mono uppercase">
            Evolução Diária do Posicionamento de Derivativos
          </h3>
          <span className="text-[11px] text-gray-400 font-mono">Últimos 5 pregões</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead className="bg-[#070b14] text-gray-400 uppercase text-[10px] border-b border-gray-800">
              <tr>
                <th className="p-3.5">Dia</th>
                <th className="p-3.5">Data</th>
                <th className="p-3.5">Spot ($)</th>
                <th className="p-3.5">Total CALL OI</th>
                <th className="p-3.5">Total PUT OI</th>
                <th className="p-3.5">Put/Call Ratio</th>
                <th className="p-3.5">Max Pain ($)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {trackingDays.map((row, idx) => {
                const pc = row.putOi / row.callOi;
                const isToday = row.day === 'HOJE';
                return (
                  <tr
                    key={idx}
                    className={`hover:bg-gray-800/30 transition ${
                      isToday ? 'bg-purple-950/20 font-bold text-white' : 'text-gray-300'
                    }`}
                  >
                    <td className="p-3.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] ${
                          isToday ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40' : 'bg-gray-800 text-gray-400'
                        }`}
                      >
                        {row.day}
                      </span>
                    </td>
                    <td className="p-3.5 text-gray-400">{row.date}</td>
                    <td className="p-3.5 font-bold">
                      <DataValue value={row.spot} format="currency" provenance={trackProv} source={trackSource} />
                    </td>
                    <td className="p-3.5 text-emerald-400">
                      <DataValue value={row.callOi} format="number" provenance={trackProv} source={trackSource} />
                    </td>
                    <td className="p-3.5 text-rose-400">
                      <DataValue value={row.putOi} format="number" provenance={trackProv} source={trackSource} />
                    </td>
                    <td className="p-3.5 text-cyan-400">
                      <DataValue value={pc} format="number" provenance="DERIVADO" source="Put OI / Call OI" />
                    </td>
                    <td className="p-3.5 text-amber-400 font-bold">
                      <DataValue value={row.maxPain} format="currency" provenance={trackProv} source={trackSource} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
