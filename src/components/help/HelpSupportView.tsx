'use client';

import React, { useState } from 'react';
import { BookOpen, ChevronDown, Bot, Send, PlayCircle, Play } from 'lucide-react';

export function HelpSupportView() {
  const [openTopic, setOpenTopic] = useState<number | null>(1);

  const topics = [
    {
      id: 1,
      title: 'Arquitetura das 3 Camadas + Motor GEX',
      subtitle: 'Visão Geral do Modelo de Decisão',
      content: 'O sistema combina de forma estrita 3 camadas independentes: 1) Técnica (Médias Móveis e Momentum), 2) Fundamentos e Solvência, e 3) Derivativos & Gamma Exposure (GEX) da Tastytrade em tempo real.',
    },
    {
      id: 2,
      title: 'O que é Gamma Exposure (GEX) e Zero Gamma Flip',
      subtitle: 'Mecânica de Formadores de Mercado (Market Makers)',
      content: 'GEX mede o rebalanceamento de Delta dos Market Makers. Quando o preço está acima do Zero Gamma Flip, os MMs operam contra a tendência (comprando na queda e vendendo na alta), comprimindo a volatilidade. Abaixo do Zero Gamma, operam a favor da tendência, amplificando quedas.',
    },
    {
      id: 3,
      title: 'Como a tendência é determinada',
      subtitle: 'Técnico CNPI-T',
      content: 'Alinhamento das médias móveis aritméticas de 20, 50 e 200 períodos diários (MMA20 > MMA50 > MMA200 para alta, e MMA20 < MMA50 < MMA200 para baixa), com filtro de RSI(14) saudável entre 40 e 65.',
    },
    {
      id: 4,
      title: 'Rastreador de Tendências & Execução de Iron Condor',
      subtitle: 'Classificação Alta / Baixa / Lateral',
      content: 'O rastreador classifica ativos em 3 regimes: compras direcionais em tendências claras de alta, travas de baixa com opções em tendências baixistas, e operações estruturadas de renda lateral (Iron Condor #20 a crédito com 4 pernas) quando o IV Rank for favorável.',
    },
  ];

  return (
    <section className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-3">
          <div className="p-4 rounded-xl bg-[#0c1322] border border-gray-800">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-emerald-400" />
              Manual de Operações & Metodologia Quantitativa (Radar + GEX)
            </h3>
            <p className="text-xs text-gray-400 mt-1">Guia detalhado de como o sistema analisa tendências, valida fundamentos, calcula o Gamma Exposure e estrutura posições com a Tastytrade.</p>
          </div>

          <div className="space-y-2 font-mono text-xs">
            {topics.map((t) => (
              <div key={t.id} className="bg-[#0c1322] border border-gray-800 rounded-xl overflow-hidden">
                <button
                  onClick={() => setOpenTopic(openTopic === t.id ? null : t.id)}
                  className="w-full p-3.5 text-left flex items-center justify-between hover:bg-slate-800/40"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-lg bg-[#070b14] border border-gray-700 text-cyan-400 flex items-center justify-center font-bold text-xs">
                      {String(t.id).padStart(2, '0')}
                    </span>
                    <div>
                      <div className="font-bold text-white">{t.title}</div>
                      <div className="text-[10px] text-gray-400">{t.subtitle}</div>
                    </div>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${openTopic === t.id ? 'rotate-180' : ''}`} />
                </button>
                {openTopic === t.id && (
                  <div className="p-4 pt-1 text-[11px] text-gray-300 font-sans border-t border-gray-800/60 leading-relaxed bg-[#090e18]">
                    {t.content}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-5 space-y-4">
          <div className="bg-[#0c1322] border border-gray-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2 border-b border-gray-800 pb-2.5">
              <Bot className="w-4 h-4 text-purple-400" />
              <span className="text-xs font-bold font-mono text-white">Consultor IA & Dúvidas Operacionais</span>
            </div>

            <div className="relative">
              <input type="text" placeholder="Faça uma pergunta sobre o manual ou GEX..." className="w-full bg-[#070b14] border border-gray-700 rounded-lg pl-3 pr-10 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-purple-500" />
              <button className="absolute right-2 top-2 p-1.5 rounded-md bg-purple-600 hover:bg-purple-500 text-white transition">
                <Send className="w-3 h-3" />
              </button>
            </div>
          </div>

          <div className="bg-[#0c1322] border border-gray-800 rounded-2xl p-4 space-y-3">
            <div className="flex justify-between items-center border-b border-gray-800 pb-2">
              <div className="flex items-center gap-2">
                <PlayCircle className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold font-mono text-white">Vídeo: Desmistificando o Radar Tastytrade</span>
              </div>
              <span className="px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 text-[10px] font-mono">AULA COMPLETA</span>
            </div>

            <div className="w-full h-44 bg-[#070b14] border border-gray-800 rounded-xl flex flex-col items-center justify-center p-4 text-center relative overflow-hidden group cursor-pointer">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500 text-emerald-400 flex items-center justify-center group-hover:scale-110 transition shadow-lg shadow-emerald-500/30">
                <Play className="w-6 h-6 ml-0.5 fill-current" />
              </div>
              <div className="mt-2 text-xs font-bold text-white">Desmistificando o Radar Tastytrade + GEX</div>
              <div className="text-[10px] text-gray-400 font-mono">Duração: 9:17 • Arquitetura 3 Camadas & Motor GEX US</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}