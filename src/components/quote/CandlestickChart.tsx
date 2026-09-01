'use client';

import React, { useState } from 'react';
import { CandleDataPoint } from '@/lib/domain/us-market-data';

interface CandlestickChartProps {
  candles: CandleDataPoint[];
  spotPrice: number;
}

export function CandlestickChart({ candles, spotPrice }: CandlestickChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (!candles || candles.length < 2) {
    return <div className="p-8 text-center text-gray-500 font-mono text-xs">Dados de candlestick insuficientes.</div>;
  }

  const width = 1100;
  const mainHeight = 240;
  const volHeight = 45;
  const rsiHeight = 40;
  const macdHeight = 40;
  const totalHeight = mainHeight + volHeight + rsiHeight + macdHeight + 40;

  const minPrice = Math.min(...candles.map(c => c.low)) * 0.985;
  const maxPrice = Math.max(...candles.map(c => c.high)) * 1.015;
  const priceRange = maxPrice - minPrice || 1;

  const maxVol = Math.max(...candles.map(c => c.volume)) || 1;

  const candleWidth = Math.max(3, (width - 120) / candles.length - 2);

  const getY = (price: number) => {
    return mainHeight - ((price - minPrice) / priceRange) * (mainHeight - 20) - 10;
  };

  const activeCandle = hoverIndex !== null ? candles[hoverIndex] : candles[candles.length - 1];

  // Resistance and Support Levels
  const res1 = spotPrice * 1.05;
  const sup1 = spotPrice * 0.96;

  return (
    <div className="w-full bg-[#070b14] p-3 rounded-xl border border-gray-900 overflow-hidden font-mono select-none">
      
      {/* Tooltip Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-gray-400 border-b border-gray-800/80 pb-2 mb-2">
        <div className="flex items-center gap-3">
          <span className="text-white font-bold">{activeCandle.date}</span>
          <span>O: <strong className="text-white">${activeCandle.open.toFixed(2)}</strong></span>
          <span>H: <strong className="text-emerald-400">${activeCandle.high.toFixed(2)}</strong></span>
          <span>L: <strong className="text-rose-400">${activeCandle.low.toFixed(2)}</strong></span>
          <span>C: <strong className={activeCandle.close >= activeCandle.open ? 'text-emerald-400' : 'text-rose-400'}>${activeCandle.close.toFixed(2)}</strong></span>
          <span>Vol: <strong className="text-cyan-300">{(activeCandle.volume / 1e6).toFixed(1)}M</strong></span>
        </div>
        <div className="flex items-center gap-3 text-[10px]">
          <span className="text-amber-400">MA20: ${activeCandle.ma20.toFixed(2)}</span>
          <span className="text-cyan-400">MA50: ${activeCandle.ma50.toFixed(2)}</span>
          <span className="text-purple-400">MA200: ${activeCandle.ma200.toFixed(2)}</span>
          <span className="text-emerald-400">RSI(14): {activeCandle.rsi}</span>
        </div>
      </div>

      <svg viewBox={`0 0 ${width} ${totalHeight}`} className="w-full h-auto">
        {/* Horizontal Grid lines */}
        {[0.2, 0.4, 0.6, 0.8].map((ratio, i) => {
          const p = minPrice + ratio * priceRange;
          const y = getY(p);
          return (
            <g key={i}>
              <line x1="0" y1={y} x2={width - 80} y2={y} stroke="#1f293d" strokeDasharray="3 3" strokeWidth="0.8" />
              <text x={width - 70} y={y + 3} fill="#64748b" fontSize="10">
                ${p.toFixed(2)}
              </text>
            </g>
          );
        })}

        {/* Support & Resistance Lines */}
        <line x1="0" y1={getY(res1)} x2={width - 80} y2={getY(res1)} stroke="#f43f5e" strokeDasharray="4 4" strokeWidth="1.2" />
        <text x={width - 75} y={getY(res1) + 3} fill="#f43f5e" fontSize="9" fontWeight="bold">
          RES ${res1.toFixed(2)}
        </text>

        <line x1="0" y1={getY(sup1)} x2={width - 80} y2={getY(sup1)} stroke="#10b981" strokeDasharray="4 4" strokeWidth="1.2" />
        <text x={width - 75} y={getY(sup1) + 3} fill="#10b981" fontSize="9" fontWeight="bold">
          SUP ${sup1.toFixed(2)}
        </text>

        {/* MA20, MA50, MA200 Lines */}
        {(() => {
          const ma20Points = candles.map((c, i) => `${30 + i * ((width - 120) / candles.length)},${getY(c.ma20)}`).join(' ');
          const ma50Points = candles.map((c, i) => `${30 + i * ((width - 120) / candles.length)},${getY(c.ma50)}`).join(' ');
          const ma200Points = candles.map((c, i) => `${30 + i * ((width - 120) / candles.length)},${getY(c.ma200)}`).join(' ');
          return (
            <>
              <polyline points={ma20Points} fill="none" stroke="#f59e0b" strokeWidth="1.5" />
              <polyline points={ma50Points} fill="none" stroke="#06b6d4" strokeWidth="1.5" />
              <polyline points={ma200Points} fill="none" stroke="#8b5cf6" strokeWidth="1.5" />
            </>
          );
        })()}

        {/* Candlesticks & Volume */}
        {candles.map((c, i) => {
          const x = 30 + i * ((width - 120) / candles.length);
          const isUp = c.close >= c.open;
          const color = isUp ? '#10b981' : '#f43f5e';
          const top = Math.min(getY(c.open), getY(c.close));
          const bot = Math.max(getY(c.open), getY(c.close));
          const h = Math.max(2, bot - top);

          // Volume Bar
          const volY = mainHeight + 10 + (volHeight - (c.volume / maxVol) * volHeight);
          const volH = (c.volume / maxVol) * volHeight;

          // RSI point
          const rsiY = mainHeight + volHeight + 20 + (rsiHeight - (c.rsi / 100) * rsiHeight);

          // MACD bar
          const macdCenter = mainHeight + volHeight + rsiHeight + 30 + (macdHeight / 2);
          const macdH = Math.min(macdHeight / 2 - 2, Math.abs(c.macdHist) * 12);
          const macdY = c.macdHist >= 0 ? macdCenter - macdH : macdCenter;

          return (
            <g
              key={i}
              onMouseEnter={() => setHoverIndex(i)}
              className="cursor-pointer"
            >
              {/* Wick */}
              <line x1={x} y1={getY(c.high)} x2={x} y2={getY(c.low)} stroke={color} strokeWidth="1.2" />

              {/* Body */}
              <rect
                x={x - candleWidth / 2}
                y={top}
                width={candleWidth}
                height={h}
                fill={color}
                rx="1"
              />

              {/* Volume */}
              <rect
                x={x - candleWidth / 2}
                y={volY}
                width={candleWidth}
                height={volH}
                fill={color}
                opacity="0.8"
              />

              {/* MACD Hist bar */}
              <rect
                x={x - candleWidth / 2}
                y={macdY}
                width={candleWidth}
                height={macdH}
                fill={c.macdHist >= 0 ? '#10b981' : '#f43f5e'}
              />
            </g>
          );
        })}

        {/* RSI Reference Lines (30, 50, 70) */}
        <line x1="0" y1={mainHeight + volHeight + 20 + (rsiHeight * 0.3)} x2={width - 80} y2={mainHeight + volHeight + 20 + (rsiHeight * 0.3)} stroke="#8b5cf6" strokeDasharray="2 2" strokeWidth="0.8" />
        <line x1="0" y1={mainHeight + volHeight + 20 + (rsiHeight * 0.7)} x2={width - 80} y2={mainHeight + volHeight + 20 + (rsiHeight * 0.7)} stroke="#8b5cf6" strokeDasharray="2 2" strokeWidth="0.8" />
        <text x={width - 70} y={mainHeight + volHeight + 35} fill="#a78bfa" fontSize="9">RSI(14)</text>

        {/* Labels for sub-panels */}
        <text x="5" y={mainHeight + 22} fill="#64748b" fontSize="9" fontWeight="bold">VOLUME COM MÉDIA 20 DIAS</text>
        <text x="5" y={mainHeight + volHeight + 32} fill="#64748b" fontSize="9" fontWeight="bold">RSI(14) — [40-65 ZONA SAUDÁVEL CNPI-T]</text>
        <text x="5" y={mainHeight + volHeight + rsiHeight + 42} fill="#64748b" fontSize="9" fontWeight="bold">MACD (12, 26, 9) & HISTOGRAMA</text>
      </svg>
    </div>
  );
}