'use client';

import React from 'react';
import { Activity, LayoutGrid, Search, TrendingUp, Target, BookOpen, Users } from 'lucide-react';

export type ActiveTab = 'panorama' | 'consulta' | 'rastreador' | 'barreiras' | 'manual';

interface NavbarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  uniqueVisitors?: number | null;
  apiStatus?: { status: string; latencyMs: number };
}

export function Navbar({ activeTab, onTabChange, uniqueVisitors = 3, apiStatus = { status: 'ONLINE', latencyMs: 84 } }: NavbarProps) {
  return (
    <header className="sticky top-0 z-50 bg-[#090e18] border-b border-gray-800/90 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-emerald-500 to-cyan-500 flex items-center justify-center shadow-md shadow-emerald-500/20">
              <Activity className="w-5 h-5 text-slate-950 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-base tracking-wider text-white font-mono">RADAR</span>
                <span className="px-1.5 py-0.5 text-[10px] font-bold font-mono rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">TASTY</span>
                <span className="px-1.5 py-0.5 text-[10px] font-bold font-mono rounded bg-purple-500/20 text-purple-400 border border-purple-500/30">PRO IA</span>
                <span className="px-1.5 py-0.5 text-[9px] font-bold font-mono rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">+ GEX</span>
              </div>
              <p className="text-[9px] text-gray-400 font-mono tracking-tight">US • TASTYTRADE • GEX & CNPI-US Engine</p>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-1.5 bg-[#070b14] p-1 rounded-xl border border-gray-800/80">
            <button
              onClick={() => onTabChange('panorama')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all flex items-center gap-1.5 border ${
                activeTab === 'panorama'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-sm font-bold'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Panorama Geral</span>
            </button>

            <button
              onClick={() => onTabChange('consulta')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all flex items-center gap-1.5 border ${
                activeTab === 'consulta'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-sm font-bold'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              <span>Consulta & Gráfico 12M</span>
            </button>

            <button
              onClick={() => onTabChange('rastreador')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all flex items-center gap-1.5 border ${
                activeTab === 'rastreador'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-sm font-bold'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Rastreador de Tendências</span>
            </button>

            <button
              onClick={() => onTabChange('barreiras')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all flex items-center gap-1.5 border ${
                activeTab === 'barreiras'
                  ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40 shadow-sm font-bold'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              <Target className="w-3.5 h-3.5 text-cyan-400" />
              <span>Barreiras & Motor GEX</span>
            </button>

            <button
              onClick={() => onTabChange('manual')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all flex items-center gap-1.5 border ${
                activeTab === 'manual'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-sm font-bold'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Manual & Ajuda IA</span>
            </button>
          </nav>

          <div className="flex items-center gap-2.5">
            {uniqueVisitors && (
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#0c1322] border border-gray-800 text-[11px] font-mono text-cyan-300">
                <Users className="w-3 h-3 text-cyan-400" />
                <span><strong>{uniqueVisitors}</strong> únicos</span>
              </div>
            )}

            <div className="hidden lg:block text-[11px] font-mono text-gray-400">
              v3.2.0 • 01/09/2026
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/60 border border-emerald-700/50 text-emerald-400 text-[11px] font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>TASTYTRADE + DXLink <strong className="text-emerald-300">{apiStatus.latencyMs}ms</strong></span>
            </div>
          </div>

        </div>
      </div>
    </header>
  );
}