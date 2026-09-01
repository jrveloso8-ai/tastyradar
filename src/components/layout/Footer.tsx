import React from 'react';
import { Shield } from 'lucide-react';

export function Footer() {
  return (
    <footer className="w-full border-t border-gray-800/80 bg-[#090e18] py-4 px-4 sm:px-6 lg:px-8 mt-auto">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2 text-gray-400">
          <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
          <span className="font-bold text-white font-mono">RADAR TASTYTRADE PRO IA</span>
          <span className="text-gray-600">|</span>
          <span className="font-mono text-emerald-400 font-semibold">v3.2.0 (US Edition + GEX Engine)</span>
          <span className="text-gray-600">•</span>
          <span className="text-gray-400">Publicado em: <strong className="text-gray-300">01/09/2026</strong></span>
        </div>

        <div className="flex items-center gap-4 text-gray-500 text-[11px] font-mono">
          <span>Tastytrade Open API & DXLink Realtime</span>
          <span className="text-gray-700">•</span>
          <span className="text-emerald-400/80 flex items-center gap-1">
            <Shield className="w-3 h-3 text-emerald-400" />
            CNPI 3 Camadas US + GEX Realtime
          </span>
        </div>
      </div>
    </footer>
  );
}