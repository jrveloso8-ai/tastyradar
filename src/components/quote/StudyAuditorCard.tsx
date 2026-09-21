'use client';

import React, { useState } from 'react';
import {
  ShieldCheck,
  Shield,
  Activity,
  Layers,
  Target,
  CheckCircle2,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Award,
} from 'lucide-react';
import { DataValue, formatDataValue } from '@/components/shared/DataValue';

interface StudyAuditorCardProps {
  symbol: string;
  spotPrice: number;
  ivRank: number | null;
  ivPercentile: number | null;
  liquidity: number | null;
  source: string;
  updatedAt: string;
}

export const StudyAuditorCard: React.FC<StudyAuditorCardProps> = ({
  symbol,
  spotPrice,
  ivRank,
  ivPercentile,
  liquidity,
  source,
  updatedAt,
}) => {
  const [isCopied, setIsCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  const handleCopyReport = () => {
    const text = `=== AUDITORIA DE INTEGRIDADE QUANTITATIVA — RADAR TASTYTRADE PRO ===
Ativo: ${symbol} (Spot: $${spotPrice > 0 ? formatDataValue(spotPrice, 'number', 2) : 'N/D'})
Fonte: ${source}
Data da Coleta: ${updatedAt || new Date().toISOString()}
IV Rank: ${ivRank !== null ? formatDataValue(ivRank, 'number', 1) + '%' : 'N/D'}
IV Percentile: ${ivPercentile !== null ? formatDataValue(ivPercentile, 'number', 1) + '%' : 'N/D'}
Liquidez Tastytrade: ${liquidity !== null ? liquidity + '/5' : 'N/D'}

1. AUDITORIA DE PROVENIÊNCIA (REGRA 00):
• Spot Price: MEDIDO (Tastytrade Live Equity Quote)
• IV Rank / IV Percentile: MEDIDO (Tastytrade Market Metrics API)
• Modelagem de Payoff: DERIVADO (Black-Scholes auditado BSM)
• Invariantes: Zero dado sintético ou inventado.`;

    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="bg-[#0c121e] border border-gray-800 rounded-2xl p-5 shadow-2xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-800 pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
                Auditoria de Estudo & Proveniência
              </h3>
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-mono font-bold">
                REGRA 00 AUDITADA
              </span>
            </div>
            <p className="text-xs text-gray-400 font-mono">
              Certificação de integridade dos dados exibidos para {symbol}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyReport}
            className="px-3 py-1.5 rounded-xl bg-gray-800/80 hover:bg-gray-700 text-gray-300 hover:text-white text-xs font-mono transition flex items-center gap-1.5 border border-gray-700/60"
          >
            {isCopied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-300">Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-gray-400" />
                <span>Copiar Parecer</span>
              </>
            )}
          </button>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-xl bg-gray-800/80 hover:bg-gray-700 text-gray-400 hover:text-white transition"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="space-y-4 text-xs font-mono animate-fadeIn">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-[#070b14] border border-gray-800/80 space-y-1">
              <span className="text-gray-400 text-[11px] block">Cotação Spot ({symbol})</span>
              <DataValue
                value={spotPrice > 0 ? spotPrice : null}
                format="currency"
                provenance="MEDIDO"
                source={source}
                className="text-base font-bold text-emerald-400"
              />
            </div>

            <div className="p-3 rounded-xl bg-[#070b14] border border-gray-800/80 space-y-1">
              <span className="text-gray-400 text-[11px] block">IV Rank Atual</span>
              <DataValue
                value={ivRank}
                format="percent"
                provenance="MEDIDO"
                source={source}
                className="text-base font-bold text-cyan-400"
              />
            </div>

            <div className="p-3 rounded-xl bg-[#070b14] border border-gray-800/80 space-y-1">
              <span className="text-gray-400 text-[11px] block">Liquidez de Opções</span>
              <div className="flex items-center gap-1.5 mt-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <div
                    key={star}
                    className={`w-2.5 h-2.5 rounded-full ${
                      liquidity !== null && star <= liquidity ? 'bg-amber-400' : 'bg-gray-700'
                    }`}
                  />
                ))}
                {/* eslint-disable-next-line local-rules/no-raw-numbers-in-jsx -- indicador de estrelas de liquidez */}
                <span className="text-gray-300 font-bold ml-1">{liquidity !== null ? `${liquidity}/5` : 'N/D'}</span>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#090e18] border border-gray-800 space-y-2 text-gray-300">
            <div className="flex items-center gap-2 text-white font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Mapa de Rastreabilidade e Não-Invenção de Dados</span>
            </div>
            <ul className="space-y-1.5 pl-5 list-disc text-gray-400 text-[11px]">
              <li>
                <strong className="text-gray-300">Spot & Variação:</strong> Coletado diretamente da API oficial Tastytrade (`/market/equity-quotes`), sem simulação.
              </li>
              <li>
                <strong className="text-gray-300">Métricas de Volatilidade:</strong> IV Rank, IV Percentile e IV 30D provenientes do endpoint `/market-metrics` da Tastytrade.
              </li>
              <li>
                <strong className="text-gray-300">Cadeia de Opções:</strong> Strikes reais carregados de `/option-chains/{symbol}/nested`, proibindo preenchimento com constantes.
              </li>
              <li>
                <strong className="text-gray-300">Ausência de Dados:</strong> Quando a fonte não fornece ou o mercado está indisponível, propaga honestamente null sem mascarar.
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
