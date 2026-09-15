'use client';

import React, { useState } from 'react';
import { Crosshair } from 'lucide-react';
import { DataValue } from '@/components/shared/DataValue';

export interface HistoricalCandle {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

interface StockTradePlanChartProps {
  symbol: string;
  historicalPrices: HistoricalCandle[];
  entryPrice: number;
  stopLoss: number;
  target1: number;
  target2: number;
  bias: 'LONG' | 'SHORT' | string;
}

export const StockTradePlanChart: React.FC<StockTradePlanChartProps> = ({
  symbol,
  historicalPrices,
  entryPrice,
  stopLoss,
  target1,
  target2,
  bias,
}) => {
  const [period, setPeriod] = useState<number>(60);

  const visibleHistory = (historicalPrices || []).slice(
    Math.max(0, (historicalPrices || []).length - period)
  );

  if (visibleHistory.length < 2) {
    return (
      <div className="p-6 bg-[#070b14] rounded-xl border border-gray-800 text-center text-xs text-gray-400 font-mono">
        Histórico insuficiente para gerar gráfico de trade plan.
      </div>
    );
  }

  const keyPrices = [entryPrice, stopLoss, target1, target2].filter((p) => p > 0);
  const candleLows = visibleHistory.map((h) => h.low);
  const candleHighs = visibleHistory.map((h) => h.high);

  const minPrice = Math.min(...candleLows, ...keyPrices) * 0.98;
  const maxPrice = Math.max(...candleHighs, ...keyPrices) * 1.02;

  const width = 760;
  const height = 300;
  const padL = 40;
  const padR = 120;
  const padT = 25;
  const padB = 30;

  const chartW = width - padL - padR;
  const chartH = height - padT - padB;

  const candleCount = visibleHistory.length;
  const candleStep = chartW / candleCount;
  const candleWidth = Math.max(2.5, candleStep * 0.65);

  const getY = (p: number) => padT + chartH - ((p - minPrice) / (maxPrice - minPrice)) * chartH;

  const yEntry = getY(entryPrice);
  const yStop = getY(stopLoss);
  const yTarget1 = getY(target1);
  const yTarget2 = getY(target2);

  const isLong = bias === 'LONG' || bias === 'ALTA';
  const planProv = 'ESTIMADO';
  const planSource = 'Modelo quantitativo de suporte e resistência';

  return (
    <div className="bg-[#0b101b] border border-gray-800/90 rounded-2xl p-4 shadow-xl space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-800/80 pb-3">
        <div className="flex items-center gap-2">
          <Crosshair className="w-4 h-4 text-emerald-400" />
          <h3 className="text-xs font-bold text-white font-mono uppercase tracking-wider">
            Plano Gráfico de Trade — {symbol}
          </h3>
          <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-mono text-emerald-400 font-bold">
            {isLong ? 'BULLISH / COMPRA' : 'BEARISH / VENDA'}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {([30, 60, 90] as const).map((p) => {
            const pLabel = `${p}D`;
            return (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-2 py-0.5 rounded text-[10px] font-mono transition ${
                  period === p
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold'
                    : 'bg-gray-800/60 text-gray-400 hover:text-white border border-transparent'
                }`}
              >
                {pLabel}
              </button>
            );
          })}
        </div>
      </div>

      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto max-h-[300px] select-none font-mono"
        >
          {([0.25, 0.5, 0.75] as const).map((pct, idx) => {
            const gridY = padT + chartH * pct;
            const priceVal = maxPrice - (maxPrice - minPrice) * pct;
            return (
              <g key={idx}>
                <line
                  x1={padL}
                  y1={gridY}
                  x2={padL + chartW}
                  y2={gridY}
                  stroke="#1f293d"
                  strokeDasharray="3,3"
                />
                <text
                  x={padL - 6}
                  y={gridY + 3}
                  fill="#4b5563"
                  fontSize="9"
                  textAnchor="end"
                >
                  <DataValue variant="inline" as="tspan" value={priceVal} format="currency" provenance={planProv} source={planSource} />
                </text>
              </g>
            );
          })}

          {visibleHistory.map((c, i) => {
            const x = padL + i * candleStep + candleStep / 2;
            const yOpen = getY(c.open);
            const yClose = getY(c.close);
            const yHigh = getY(c.high);
            const yLow = getY(c.low);
            const isUp = c.close >= c.open;
            const color = isUp ? '#10b981' : '#ef4444';
            const bodyY = Math.min(yOpen, yClose);
            const bodyH = Math.max(1.5, Math.abs(yOpen - yClose));

            return (
              <g key={i}>
                <line x1={x} y1={yHigh} x2={x} y2={yLow} stroke={color} strokeWidth="1" />
                <rect
                  x={x - candleWidth / 2}
                  y={bodyY}
                  width={candleWidth}
                  height={bodyH}
                  fill={color}
                  rx="0.5"
                />
              </g>
            );
          })}

          {stopLoss > 0 && (
            <g>
              <line
                x1={padL}
                y1={yStop}
                x2={padL + chartW + 8}
                y2={yStop}
                stroke="#ef4444"
                strokeWidth="1.5"
                strokeDasharray="4,3"
              />
              <rect
                x={padL + chartW + 12}
                y={yStop - 9}
                width="80"
                height="18"
                rx="4"
                fill="#450a0a"
                stroke="#ef4444"
                strokeWidth="1"
              />
              <text x={padL + chartW + 16} y={yStop + 3} fill="#fca5a5" fontSize="9" fontWeight="bold">
                STOP: <DataValue variant="inline" as="tspan" value={stopLoss} format="currency" provenance={planProv} source={planSource} />
              </text>
            </g>
          )}

          {entryPrice > 0 && (
            <g>
              <line
                x1={padL}
                y1={yEntry}
                x2={padL + chartW + 8}
                y2={yEntry}
                stroke="#3b82f6"
                strokeWidth="1.5"
              />
              <rect
                x={padL + chartW + 12}
                y={yEntry - 9}
                width="80"
                height="18"
                rx="4"
                fill="#172554"
                stroke="#3b82f6"
                strokeWidth="1"
              />
              <text x={padL + chartW + 16} y={yEntry + 3} fill="#93c5fd" fontSize="9" fontWeight="bold">
                ENTRY: <DataValue variant="inline" as="tspan" value={entryPrice} format="currency" provenance={planProv} source={planSource} />
              </text>
            </g>
          )}

          {target1 > 0 && (
            <g>
              <line
                x1={padL}
                y1={yTarget1}
                x2={padL + chartW + 8}
                y2={yTarget1}
                stroke="#10b981"
                strokeWidth="1.5"
                strokeDasharray="4,3"
              />
              <rect
                x={padL + chartW + 12}
                y={yTarget1 - 9}
                width="80"
                height="18"
                rx="4"
                fill="#064e3b"
                stroke="#10b981"
                strokeWidth="1"
              />
              <text x={padL + chartW + 16} y={yTarget1 + 3} fill="#6ee7b7" fontSize="9" fontWeight="bold">
                ALVO 1: <DataValue variant="inline" as="tspan" value={target1} format="currency" provenance={planProv} source={planSource} />
              </text>
            </g>
          )}

          {target2 > 0 && (
            <g>
              <line
                x1={padL}
                y1={yTarget2}
                x2={padL + chartW + 8}
                y2={yTarget2}
                stroke="#06b6d4"
                strokeWidth="1.5"
                strokeDasharray="4,3"
              />
              <rect
                x={padL + chartW + 12}
                y={yTarget2 - 9}
                width="80"
                height="18"
                rx="4"
                fill="#083344"
                stroke="#06b6d4"
                strokeWidth="1"
              />
              <text x={padL + chartW + 16} y={yTarget2 + 3} fill="#67e8f9" fontSize="9" fontWeight="bold">
                ALVO 2: <DataValue variant="inline" as="tspan" value={target2} format="currency" provenance={planProv} source={planSource} />
              </text>
            </g>
          )}
        </svg>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-gray-800/60 text-xs">
        <div className="p-2 rounded-xl bg-gray-900/60 border border-gray-800/80">
          <span className="text-[10px] text-gray-400 font-mono block">Preço Entrada</span>
          <DataValue value={entryPrice} format="currency" provenance={planProv} source={planSource} className="text-white font-mono font-bold" />
        </div>

        <div className="p-2 rounded-xl bg-red-950/20 border border-red-500/20">
          <span className="text-[10px] text-red-400 font-mono block">Stop Loss</span>
          <DataValue value={stopLoss} format="currency" provenance={planProv} source={planSource} className="text-red-300 font-mono font-bold" />
        </div>

        <div className="p-2 rounded-xl bg-emerald-950/20 border border-emerald-500/20">
          <span className="text-[10px] text-emerald-400 font-mono block">Alvo Primário</span>
          <DataValue value={target1} format="currency" provenance={planProv} source={planSource} className="text-emerald-300 font-mono font-bold" />
        </div>

        <div className="p-2 rounded-xl bg-cyan-950/20 border border-cyan-500/20">
          <span className="text-[10px] text-cyan-400 font-mono block">Alvo Secundário</span>
          <DataValue value={target2} format="currency" provenance={planProv} source={planSource} className="text-cyan-300 font-mono font-bold" />
        </div>
      </div>
    </div>
  );
};
