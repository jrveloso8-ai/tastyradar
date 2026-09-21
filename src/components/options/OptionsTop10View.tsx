'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  Search,
  RefreshCw,
  AlertTriangle,
  TrendingUp,
  BarChart2,
  Shield,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
  Award,
} from 'lucide-react';
import { DataValue } from '@/components/shared/DataValue';

export interface Top10StrikeItem {
  strike: number;
  symbol: string;
  type: 'CALL' | 'PUT';
  openInterest: number;
  distancePct: number;
  inTheMoney: boolean;
  delta?: number | null;
}

export interface Top10OIResponse {
  symbol: string;
  spotPrice: number;
  selectedExpiration: string;
  availableExpirations: Array<{ date: string; dte: number }>;
  top10Calls: Top10StrikeItem[];
  top10Puts: Top10StrikeItem[];
  totalCallOI: number;
  totalPutOI: number;
  pcRatioOI: number | null;
  rankingUniverse?: string;
  source: string;
  updatedAt: string;
}

interface OptionsTop10ViewProps {
  initialSymbol?: string;
  onSelectSymbol?: (sym: string) => void;
}

export const OptionsTop10View: React.FC<OptionsTop10ViewProps> = ({
  initialSymbol = 'NVDA',
  onSelectSymbol,
}) => {
  const [symbol, setSymbol] = useState(initialSymbol);
  const [searchInput, setSearchInput] = useState(initialSymbol);
  const [selectedExpiration, setSelectedExpiration] = useState<string>('');
  const [data, setData] = useState<Top10OIResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const popularAssets = ['NVDA', 'SPY', 'QQQ', 'AAPL', 'MSFT', 'TSLA', 'AMZN', 'META'];

  const fetchTop10 = useCallback(async (ticker: string, expiration?: string) => {
    setLoading(true);
    setError(null);

    try {
      const expParam = expiration ? `&expiration=${encodeURIComponent(expiration)}` : '';
      const res = await fetch(`/api/options/top10-oi?symbol=${encodeURIComponent(ticker)}${expParam}`);
      const json = await res.json();

      if (res.ok && json.data) {
        setData(json.data);
        setSymbol(ticker);
        if (!selectedExpiration || selectedExpiration === '') {
          setSelectedExpiration(json.data.selectedExpiration || '');
        }
      } else {
        setData(null);
        setError(json.error || 'Não foi possível carregar a cadeia de opções.');
      }
    } catch {
      setData(null);
      setError('Erro de conexão ao buscar cadeia de opções.');
    } finally {
      setLoading(false);
    }
  }, [selectedExpiration]);

  useEffect(() => {
    if (initialSymbol) {
      setSymbol(initialSymbol);
      setSearchInput(initialSymbol);
      fetchTop10(initialSymbol);
    }
  }, [initialSymbol, fetchTop10]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      const clean = searchInput.trim().toUpperCase();
      setSymbol(clean);
      onSelectSymbol?.(clean);
      fetchTop10(clean, selectedExpiration);
    }
  };

  const handleExpirationChange = (exp: string) => {
    setSelectedExpiration(exp);
    fetchTop10(symbol, exp);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Barra Superior de Busca & Filtros */}
      <div className="bg-[#0c121e] border border-gray-800 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
            <BarChart2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">
              <span>Top 10 Concentração de Derivativos — {symbol}</span>
              <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-[10px] text-emerald-400 font-bold">
                TASTYTRADE LIVE
              </span>
            </h2>
            <p className="text-xs text-gray-400 font-mono">
              Strikes com maior densidade de posições abertas na cadeia de opções
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {data?.availableExpirations && data.availableExpirations.length > 0 && (
            <div className="flex items-center gap-1.5 bg-[#070b14] border border-gray-800 px-3 py-1.5 rounded-xl">
              <Calendar className="w-3.5 h-3.5 text-gray-400" />
              <select
                value={selectedExpiration || data.selectedExpiration}
                onChange={(e) => handleExpirationChange(e.target.value)}
                className="bg-transparent text-xs font-mono text-white focus:outline-none cursor-pointer"
              >
                {data.availableExpirations.map((exp) => {
                  const expLabel = `${exp.date} (${exp.dte} DTE)`;
                  return (
                    <option key={exp.date} value={exp.date} className="bg-gray-900 text-white">
                      {expLabel}
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          <form onSubmit={handleSearch} className="flex items-center gap-2">
            <div className="relative w-40 sm:w-48">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value.toUpperCase())}
                placeholder="Ex: NVDA, SPY"
                className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-[#070b14] border border-gray-800 text-xs text-white font-mono placeholder-gray-500 focus:outline-none focus:border-amber-500"
              />
            </div>
            <button
              type="submit"
              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs font-mono transition"
            >
              Filtrar
            </button>
          </form>
        </div>
      </div>

      {/* Atalhos Rápidos */}
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-400">
        <span className="text-[11px] font-mono uppercase text-gray-500">Ativos Rápidos:</span>
        {popularAssets.map((ticker) => (
          <button
            key={ticker}
            onClick={() => {
              setSearchInput(ticker);
              setSymbol(ticker);
              onSelectSymbol?.(ticker);
              fetchTop10(ticker);
            }}
            className={`px-2 py-0.5 rounded-lg border font-mono text-xs transition ${
              symbol === ticker
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold'
                : 'bg-gray-900/60 text-gray-400 border-gray-800 hover:text-white'
            }`}
          >
            {ticker}
          </button>
        ))}
      </div>

      {/* Loading & Error States */}
      {loading && (
        <div className="p-12 text-center text-gray-400 font-mono text-xs bg-[#0c121e] rounded-2xl border border-gray-800">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-amber-400 mb-2" />
          Carregando cadeia oficial de opções e calculando concentração de strikes...
        </div>
      )}

      {error && !loading && (
        <div className="p-6 bg-red-950/20 border border-red-500/30 rounded-2xl text-red-300 font-mono text-xs flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Conteúdo Principal */}
      {!loading && data && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-[#0c121e] border border-gray-800">
              <span className="text-[11px] text-gray-400 font-mono block">Preço Spot ({symbol})</span>
              <DataValue
                value={data.spotPrice}
                format="currency"
                provenance="MEDIDO"
                source={data.source}
                className="text-lg font-bold text-white font-mono"
              />
            </div>

            <div className="p-4 rounded-2xl bg-[#0c121e] border border-gray-800">
              <span className="text-[11px] text-gray-400 font-mono block">Total OI (CALLs)</span>
              <DataValue
                value={data.totalCallOI}
                format="number"
                provenance="DERIVADO"
                source="Soma do OI real (DXLink Summary) dos Top 10 CALLs"
                className="text-lg font-bold text-emerald-400 font-mono"
              />
            </div>

            <div className="p-4 rounded-2xl bg-[#0c121e] border border-gray-800">
              <span className="text-[11px] text-gray-400 font-mono block">Total OI (PUTs)</span>
              <DataValue
                value={data.totalPutOI}
                format="number"
                provenance="DERIVADO"
                source="Soma do OI real (DXLink Summary) dos Top 10 PUTs"
                className="text-lg font-bold text-rose-400 font-mono"
              />
            </div>

            <div className="p-4 rounded-2xl bg-[#0c121e] border border-gray-800">
              <span className="text-[11px] text-gray-400 font-mono block">Put/Call Ratio (OI)</span>
              <DataValue
                value={data.pcRatioOI}
                format="number"
                provenance={data.pcRatioOI === null ? 'INDISPONIVEL' : 'DERIVADO'}
                source="Total Put OI / Total Call OI"
                className="text-lg font-bold text-cyan-400 font-mono"
              />
            </div>
          </div>

          {/* Grid de 2 Colunas: Top 10 CALLs e Top 10 PUTs */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top 10 CALLs */}
            <div className="bg-[#0c121e] border border-gray-800 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                <div className="flex items-center gap-2">
                  <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-xs font-bold text-white font-mono uppercase">
                    Top 10 CALLs (Resistências Institucionais)
                  </h3>
                </div>
                <span className="text-[11px] text-emerald-400 font-mono font-bold">CALLS</span>
              </div>

              <div className="space-y-2 font-mono text-xs">
                {data.top10Calls.map((c, idx) => (
                  <div
                    key={c.strike}
                    className="p-2.5 rounded-xl bg-[#070b14] border border-gray-800/80 flex items-center justify-between gap-2 hover:border-emerald-500/40 transition"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-[10px] font-bold">
                        {/* eslint-disable-next-line local-rules/no-raw-numbers-in-jsx -- índice de ranking visual */}
                        {idx + 1}
                      </span>
                      <div>
                        <DataValue value={c.strike} format="currency" provenance="MEDIDO" source={data.source} className="font-bold text-white block" />
                        <span className="text-[10px] text-gray-500 truncate max-w-[150px] block">
                          {c.symbol}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-bold text-emerald-400 flex items-center justify-end gap-1">
                        <DataValue value={c.openInterest} format="number" provenance="MEDIDO" source={data.source} />
                        <span className="text-[10px] text-gray-400">contratos</span>
                      </div>
                      <div className="text-[10px] text-gray-400 flex items-center justify-end gap-1">
                        <DataValue value={c.distancePct} format="percent" provenance="DERIVADO" source="(Strike - Spot) / Spot" />
                        <span>do Spot</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top 10 PUTs */}
            <div className="bg-[#0c121e] border border-gray-800 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                <div className="flex items-center gap-2">
                  <ArrowDownRight className="w-4 h-4 text-rose-400" />
                  <h3 className="text-xs font-bold text-white font-mono uppercase">
                    Top 10 PUTs (Suportes Institucionais)
                  </h3>
                </div>
                <span className="text-[11px] text-rose-400 font-mono font-bold">PUTS</span>
              </div>

              <div className="space-y-2 font-mono text-xs">
                {data.top10Puts.map((p, idx) => (
                  <div
                    key={p.strike}
                    className="p-2.5 rounded-xl bg-[#070b14] border border-gray-800/80 flex items-center justify-between gap-2 hover:border-rose-500/40 transition"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center text-[10px] font-bold">
                        {/* eslint-disable-next-line local-rules/no-raw-numbers-in-jsx -- índice de ranking visual */}
                        {idx + 1}
                      </span>
                      <div>
                        <DataValue value={p.strike} format="currency" provenance="MEDIDO" source={data.source} className="font-bold text-white block" />
                        <span className="text-[10px] text-gray-500 truncate max-w-[150px] block">
                          {p.symbol}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-bold text-rose-400 flex items-center justify-end gap-1">
                        <DataValue value={p.openInterest} format="number" provenance="MEDIDO" source={data.source} />
                        <span className="text-[10px] text-gray-400">contratos</span>
                      </div>
                      <div className="text-[10px] text-gray-400 flex items-center justify-end gap-1">
                        <DataValue value={p.distancePct} format="percent" provenance="DERIVADO" source="(Strike - Spot) / Spot" />
                        <span>do Spot</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
