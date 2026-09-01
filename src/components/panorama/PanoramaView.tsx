'use client';

import React, { useEffect, useRef } from 'react';
import { Gauge, Globe, PieChart, Send, Mail } from 'lucide-react';

export function PanoramaView() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const centerX = canvas.width / 2;
    const centerY = canvas.height - 10;
    const radius = 90;

    // Background Arc
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, Math.PI, 2 * Math.PI);
    ctx.lineWidth = 18;
    ctx.strokeStyle = '#1f293d';
    ctx.stroke();

    // Red zone
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, Math.PI, Math.PI + (Math.PI * 0.35));
    ctx.lineWidth = 18;
    ctx.strokeStyle = '#f43f5e';
    ctx.stroke();

    // Amber zone
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, Math.PI + (Math.PI * 0.35), Math.PI + (Math.PI * 0.55));
    ctx.lineWidth = 18;
    ctx.strokeStyle = '#f59e0b';
    ctx.stroke();

    // Green zone
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, Math.PI + (Math.PI * 0.55), 2 * Math.PI);
    ctx.lineWidth = 18;
    ctx.strokeStyle = '#10b981';
    ctx.stroke();

    // Pointer Needle for Score 58
    const score = 58;
    const angle = Math.PI + (score / 100) * Math.PI;
    const needleLength = 75;
    const needleX = centerX + needleLength * Math.cos(angle);
    const needleY = centerY + needleLength * Math.sin(angle);

    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(needleX, needleY);
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(centerX, centerY, 6, 0, 2 * Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }, []);

  return (
    <section className="space-y-6">
      {/* Sub-navegação */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-800 pb-3">
        <div className="flex items-center gap-2 text-xs font-mono text-gray-400 uppercase tracking-wider">
          <Gauge className="w-4 h-4 text-emerald-400" />
          <span>VISÃO DO PANORAMA GERAL:</span>
        </div>
        <div className="flex items-center gap-2">
          <button className="px-3 py-1 rounded-lg text-xs font-mono border border-emerald-500/40 bg-emerald-500/15 text-emerald-400 font-bold flex items-center gap-1.5">
            <Gauge className="w-3.5 h-3.5 text-emerald-400" />
            <span>1. Sentimento & Termômetro</span>
          </button>
          <button className="px-3 py-1 rounded-lg text-xs font-mono border border-gray-800 text-gray-400 hover:text-gray-200 flex items-center gap-1.5 bg-[#0c1322]">
            <Globe className="w-3.5 h-3.5" />
            <span>2. Índices Globais & US</span>
          </button>
          <button className="px-3 py-1 rounded-lg text-xs font-mono border border-gray-800 text-gray-400 hover:text-gray-200 flex items-center gap-1.5 bg-[#0c1322]">
            <PieChart className="w-3.5 h-3.5" />
            <span>3. Setores do S&P 500</span>
          </button>
        </div>
      </div>

      {/* Termômetro Principal */}
      <div className="bg-[#0c1322] border border-gray-800/90 rounded-2xl p-6 shadow-xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <Gauge className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded text-[10px] font-mono font-bold">DESTAQUE DO DIA</span>
                <h2 className="text-xl font-bold text-white tracking-tight">Termômetro de Sentimento & Apetite a Risco</h2>
                <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 rounded text-[10px] font-mono font-bold">ÚLTIMAS 24H</span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">Score consolidado ponderando Bolsas Globais, Commodities, Câmbio DXY, Curva de Juros Treasury / FOMC e Fluxo Institucional de GEX da Tastytrade.</p>
            </div>
          </div>

          <div className="bg-[#10192e] border border-gray-800 px-4 py-2 rounded-xl text-right">
            <div className="text-[10px] text-gray-400 font-mono">STATUS CONSOLIDADO</div>
            <div className="text-sm font-bold font-mono text-amber-400">MODERADAMENTE OTIMISTA (58/100)</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center pt-2">
          <div className="lg:col-span-5 bg-[#090e18] border border-gray-800/80 rounded-2xl p-5 text-center space-y-3">
            <div className="relative w-56 h-28 mx-auto flex items-end justify-center">
              <canvas ref={canvasRef} width="220" height="110"></canvas>
              <div className="absolute bottom-1 text-center">
                <div className="text-3xl font-black font-mono text-white">58</div>
              </div>
            </div>

            <div className="font-bold text-sm font-mono text-emerald-400 tracking-wide">
              ZONA NEUTRO-ALTISTA (APETITE CONTROLADO)
            </div>
            <p className="text-[11px] text-gray-400">Mercado externo favorável com Net GEX positivo (volatilidade contida) e suporte institucional em $5,980.</p>

            <div className="flex justify-between text-[10px] font-mono text-gray-500 px-2 pt-2 border-t border-gray-800/80">
              <span className="text-rose-400">0 - Pessimista</span>
              <span className="text-amber-400">50 - Neutro</span>
              <span className="text-emerald-400">100 - Otimista</span>
            </div>

            <div className="pt-2 text-left text-[10px] font-mono text-gray-400 bg-[#0c1322] p-2.5 rounded-lg border border-gray-800">
              <div className="flex justify-between items-center text-cyan-300 font-semibold mb-1">
                <span>⏱ Última consolidação: Hoje às 08h45 (US Pre-Market)</span>
                <span className="px-1 py-0.2 bg-emerald-500/20 text-emerald-400 rounded text-[9px]">EDIÇÃO CONCLUÍDA</span>
              </div>
              <div>Próxima atualização: Próximo pregão às 08h45 (US Pre-Market)</div>
            </div>
          </div>

          <div className="lg:col-span-7 space-y-2.5">
            <div className="flex justify-between text-xs font-mono text-gray-400 mb-1">
              <span>Decomposição dos 5 Pilares Quantitativos:</span>
              <span className="text-white font-bold">Score Final: 58/100</span>
            </div>

            <div className="p-3 rounded-xl bg-[#090e18] border border-gray-800 flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span className="text-gray-200">1. Bolsas Globais & Futuros EUA (Peso 20%)</span>
              </div>
              <span className="text-emerald-400 font-bold">+15 pts (Altista)</span>
            </div>

            <div className="p-3 rounded-xl bg-[#090e18] border border-gray-800 flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span className="text-gray-200">2. Commodities: Petróleo WTI & Metais (Peso 20%)</span>
              </div>
              <span className="text-emerald-400 font-bold">+12 pts (Positivo)</span>
            </div>

            <div className="p-3 rounded-xl bg-[#090e18] border border-gray-800 flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                <span className="text-gray-200">3. Câmbio DXY & Carry Trade Global (Peso 15%)</span>
              </div>
              <span className="text-cyan-400 font-bold">+10 pts (Estável)</span>
            </div>

            <div className="p-3 rounded-xl bg-[#090e18] border border-gray-800 flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                <span className="text-gray-200">4. Curva de Juros Treasury 10Y & FOMC Fed (Peso 25%)</span>
              </div>
              <span className="text-rose-400 font-bold">-12 pts (Cautela)</span>
            </div>

            <div className="p-3 rounded-xl bg-[#090e18] border border-gray-800 flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span className="text-gray-200">5. Fluxo Institucional & GEX Tastytrade (Peso 20%)</span>
              </div>
              <span className="text-emerald-400 font-bold">+13 pts (Entrada Líquida)</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4 Mini Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#0c1322] border border-gray-800 p-4 rounded-xl">
          <div className="text-[11px] text-gray-400 font-mono">FUTUROS S&P 500</div>
          <div className="text-lg font-bold font-mono text-emerald-400 mt-1">+0.82% (6.000 pts)</div>
          <div className="text-[10px] text-gray-400 mt-0.5">Tom positivo / Techs liderando</div>
        </div>

        <div className="bg-[#0c1322] border border-gray-800 p-4 rounded-xl">
          <div className="text-[11px] text-gray-400 font-mono">PETRÓLEO BRENT / WTI</div>
          <div className="text-lg font-bold font-mono text-amber-400 mt-1">US$ 78.40 / barril</div>
          <div className="text-[10px] text-gray-400 mt-0.5">Estabilidade / Geopolítica</div>
        </div>

        <div className="bg-[#0c1322] border border-gray-800 p-4 rounded-xl">
          <div className="text-[11px] text-gray-400 font-mono">DÓLAR / DXY</div>
          <div className="text-lg font-bold font-mono text-cyan-400 mt-1">DXY 103.8 • US10Y 4.42%</div>
          <div className="text-[10px] text-gray-400 mt-0.5">Treasury em patamar estável</div>
        </div>

        <div className="bg-[#0c1322] border border-gray-800 p-4 rounded-xl">
          <div className="text-[11px] text-gray-400 font-mono">NET GEX / FLUXO INSTITUCIONAL</div>
          <div className="text-lg font-bold font-mono text-emerald-400 mt-1">+$2.85 Bi (GEX)</div>
          <div className="text-[10px] text-gray-400 mt-0.5">Volatilidade contida / Suporte $5.980</div>
        </div>
      </div>

      {/* Newsletter */}
      <div className="bg-[#0c1322] border border-gray-800 p-5 rounded-2xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white">Resumo da Abertura do Mercado</h3>
              <span className="px-1.5 py-0.5 bg-cyan-500/20 text-cyan-300 rounded text-[10px] font-mono font-bold">DIÁRIO • 08h45</span>
            </div>
            <p className="text-xs text-gray-400">Receba antes da abertura do pregão o panorama global (S&P 500, Petróleo, DXY e Sentimento Tastytrade) no seu e-mail.</p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <input type="email" placeholder="Seu melhor e-mail corporativo ou pessoal..." className="bg-[#070b14] border border-gray-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-500 w-72" />
          <button className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono font-bold rounded-lg transition flex items-center gap-1.5">
            <Send className="w-3.5 h-3.5" />
            <span>Receber Resumo Diário</span>
          </button>
        </div>
      </div>
    </section>
  );
}