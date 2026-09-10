'use client';

import React, { useState, useMemo } from 'react';
import { 
  Shield, 
  Zap, 
  Activity, 
  Layers, 
  Target, 
  Info, 
  BarChart2,
  Calendar,
  ArrowLeft
} from 'lucide-react';
import { calculateGex, RawOptionData } from '@/lib/domain/gex-engine';
import { DataValue } from '@/components/shared/DataValue';

export interface ExpirationOptionItem {
  id: string;
  label: string;
  datePrefix: string;
  classification: string;
  dateOCC: string;
  type: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY';
  isLiquid: boolean;
  baseIv: number;
}

export interface ActiveExpirationOptionItem extends ExpirationOptionItem {
  dte: number;
  dateStr: string;
}

export const TASTYTRADE_EXPIRATIONS: ExpirationOptionItem[] = [
  { id: '2026-09-04', label: 'Sep 4, 2026', datePrefix: '04 Set', classification: 'Semanal W', dateOCC: '260904', type: 'WEEKLY', isLiquid: false, baseIv: 38.5 },
  { id: '2026-09-11', label: 'Sep 11, 2026', datePrefix: '11 Set', classification: 'Semanal W', dateOCC: '260911', type: 'WEEKLY', isLiquid: false, baseIv: 36.2 },
  { id: '2026-09-18', label: 'Sep 18, 2026', datePrefix: '18 Set', classification: 'Mais Líquida', dateOCC: '260918', type: 'MONTHLY', isLiquid: true, baseIv: 34.0 },
  { id: '2026-09-25', label: 'Sep 25, 2026', datePrefix: '25 Set', classification: 'Semanal W', dateOCC: '260925', type: 'WEEKLY', isLiquid: false, baseIv: 33.5 },
  { id: '2026-10-02', label: 'Oct 2, 2026', datePrefix: '02 Out', classification: 'Semanal W', dateOCC: '261002', type: 'WEEKLY', isLiquid: false, baseIv: 33.0 },
  { id: '2026-10-16', label: 'Oct 16, 2026', datePrefix: '16 Out', classification: 'Mensal Standard', dateOCC: '261016', type: 'MONTHLY', isLiquid: true, baseIv: 32.5 },
  { id: '2026-11-20', label: 'Nov 20, 2026', datePrefix: '20 Nov', classification: 'Mensal', dateOCC: '261120', type: 'MONTHLY', isLiquid: false, baseIv: 31.8 },
  { id: '2026-12-18', label: 'Dec 18, 2026', datePrefix: '18 Dez', classification: 'Trimestral', dateOCC: '261218', type: 'QUARTERLY', isLiquid: false, baseIv: 31.0 },
];

export function calculateExpirationDte(id: string, now: Date = new Date()): number {
  const [y, m, d] = id.split('-').map(Number);
  const targetMidnight = new Date(y, m - 1, d);
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffMs = targetMidnight.getTime() - todayMidnight.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

export function buildActiveExpiration(
  raw: ExpirationOptionItem,
  now: Date = new Date()
): ActiveExpirationOptionItem {
  const dte = calculateExpirationDte(raw.id, now);
  const dateStr = `${raw.datePrefix} (${dte} DTE - ${raw.classification})`;
  return {
    ...raw,
    dte,
    dateStr,
  };
}

export function getAvailableExpirations(now: Date = new Date()): ActiveExpirationOptionItem[] {
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return TASTYTRADE_EXPIRATIONS
    .filter(exp => exp.id >= todayStr)
    .map(exp => buildActiveExpiration(exp, now));
}

export function getDefaultExpirationId(now: Date = new Date()): string {
  const available = getAvailableExpirations(now);
  const liquid = available.find(e => e.isLiquid);
  return liquid ? liquid.id : (available[0]?.id ?? TASTYTRADE_EXPIRATIONS[0]?.id ?? '');
}

export interface StrikeDerivativesData {
  strike: number;
  callSymbol: string;
  putSymbol: string;
  callOi: number;
  putOi: number;
  callVol: number;
  putVol: number;
  callGex: number;
  putGex: number;
  netGex: number;
  callIv: number;
  putIv: number;
  callDelta: number;
  putDelta: number;
}

interface UnifiedGexBarreirasProps {
  symbol: string;
  spotPrice: number;
  isEmbedded?: boolean;
  onBackToQuote?: (sym: string) => void;
  onBackToScreener?: () => void;
}

export function UnifiedGexBarreirasView({ 
  symbol, 
  spotPrice, 
  isEmbedded = false,
  onBackToQuote,
  onBackToScreener
}: UnifiedGexBarreirasProps) {
  const availableExpirations = useMemo(() => {
    return getAvailableExpirations();
  }, []);

  const [selectedExpId, setSelectedExpId] = useState<string>(() => getDefaultExpirationId());
  const [gexSubView, setGexSubView] = useState<'calls_vs_puts' | 'net_gex' | 'abs_gex'>('calls_vs_puts');
  const [displayMode, setDisplayMode] = useState<'UNIFIED' | 'GEX_ONLY' | 'WALLS_ONLY' | 'SKEW_ONLY'>('UNIFIED');

  const currentExp = useMemo(() => {
    return availableExpirations.find(e => e.id === selectedExpId)
      || availableExpirations.find(e => e.isLiquid)
      || availableExpirations[0]
      || buildActiveExpiration(TASTYTRADE_EXPIRATIONS[0]);
  }, [availableExpirations, selectedExpId]);

  // Camada sintética "MODELO CALIBRADO": OI, volume, IV, delta e gamma por strike.
  // Isso NÃO é dado de mercado real (ver badge no header) — é a mesma geração
  // determinística de antes. O que muda nesta etapa é o cálculo do GEX em si:
  // em vez da fórmula própria com escala arbitrária (1e-8, chutada), os dólares
  // de GEX agora vêm do calculateGex() do gex-engine.ts — o mesmo motor testado
  // (gex-engine.test.ts) e usado como fonte única de verdade para essa conta.
  const syntheticStrikes = useMemo(() => {
    const list: {
      strike: number;
      callSymbol: string;
      putSymbol: string;
      callOi: number;
      putOi: number;
      callVol: number;
      putVol: number;
      callIv: number;
      putIv: number;
      callDelta: number;
      putDelta: number;
      gamma: number;
    }[] = [];
    const step = spotPrice > 500 ? 10 : spotPrice > 200 ? 5 : spotPrice > 50 ? 2.5 : 1;
    const numStrikes = 25;
    const centerK = Math.round(spotPrice / step) * step;
    const minK = centerK - Math.floor(numStrikes / 2) * step;

    const dteFactor = Math.sqrt(30 / Math.max(1, currentExp.dte));
    const oiScale = currentExp.isLiquid ? 1.0 : currentExp.dte <= 10 ? 0.4 : 0.7;
    const occDate = currentExp.dateOCC;

    for (let i = 0; i < numStrikes; i++) {
      const strike = Math.round((minK + i * step) * 100) / 100;
      const dist = (strike - spotPrice) / spotPrice;

      const callOiWeight = Math.exp(-Math.pow(dist - (0.03 * (currentExp.dte / 17)), 2) / 0.008);
      const putOiWeight = Math.exp(-Math.pow(dist + (0.03 * (currentExp.dte / 17)), 2) / 0.008);

      const callOi = Math.round((1500 + callOiWeight * 42000 + (strike === centerK + step ? 22000 : 0)) * oiScale);
      const putOi = Math.round((1400 + putOiWeight * 39000 + (strike === centerK - step ? 20000 : 0)) * oiScale);

      const callVol = Math.round(callOi * (0.2 + (1 / Math.max(2, currentExp.dte)) * 0.4));
      const putVol = Math.round(putOi * (0.2 + (1 / Math.max(2, currentExp.dte)) * 0.4));

      const gamma = (Math.exp(-Math.pow(dist, 2) / (0.003 / dteFactor)) / (spotPrice * 0.15)) * dteFactor;

      const baseIv = currentExp.baseIv + Math.pow(dist * 8, 2) * 1.8;
      const callIv = Math.round((baseIv - dist * 6) * 10) / 10;
      const putIv = Math.round((baseIv - dist * 12) * 10) / 10;

      const callDelta = Math.round((Math.max(0.01, Math.min(0.99, 0.5 + (spotPrice - strike) / (spotPrice * 0.18)))) * 100) / 100;
      const putDelta = Math.round((callDelta - 1) * 100) / 100;

      const symClean = symbol.toUpperCase().trim();
      const strikeStr = String(Math.round(strike * 1000)).padStart(8, '0');
      list.push({
        strike,
        callSymbol: `.${symClean}${occDate}C${strikeStr}`,
        putSymbol: `.${symClean}${occDate}P${strikeStr}`,
        callOi,
        putOi,
        callVol,
        putVol,
        callIv,
        putIv,
        callDelta,
        putDelta,
        gamma,
      });
    }

    return list;
  }, [symbol, spotPrice, currentExp]);

  // Cada strike sintético vira duas pontas (CALL/PUT) de RawOptionData, alimentando
  // o motor único de GEX em vez de uma conta local divergente.
  const rawOptionsForGex: RawOptionData[] = useMemo(() => {
    const raw: RawOptionData[] = [];
    syntheticStrikes.forEach(s => {
      raw.push({ symbol: s.callSymbol, strike: s.strike, type: 'CALL', gamma: s.gamma, openInterest: s.callOi, volume: s.callVol, delta: s.callDelta, iv: s.callIv });
      raw.push({ symbol: s.putSymbol, strike: s.strike, type: 'PUT', gamma: s.gamma, openInterest: s.putOi, volume: s.putVol, delta: s.putDelta, iv: s.putIv });
    });
    return raw;
  }, [syntheticStrikes]);

  const gexResult = useMemo(
    () => calculateGex(symbol, spotPrice, rawOptionsForGex, 'calibrated-model'),
    [symbol, spotPrice, rawOptionsForGex]
  );

  const strikesData: StrikeDerivativesData[] = useMemo(() => {
    const gexByStrike = new Map(gexResult.strikes.map(s => [s.strike, s]));
    return syntheticStrikes.map(s => {
      const g = gexByStrike.get(s.strike);
      const callGex = Math.round((g?.callGex ?? 0) * 100) / 100;
      const putGex = Math.round((g?.putGex ?? 0) * 100) / 100;
      return {
        strike: s.strike,
        callSymbol: s.callSymbol,
        putSymbol: s.putSymbol,
        callOi: s.callOi,
        putOi: s.putOi,
        callVol: s.callVol,
        putVol: s.putVol,
        callGex,
        putGex,
        netGex: Math.round((callGex + putGex) * 100) / 100,
        callIv: s.callIv,
        putIv: s.putIv,
        callDelta: s.callDelta,
        putDelta: s.putDelta,
      };
    });
  }, [syntheticStrikes, gexResult]);

  // Totais, strike de maior GEX e zero gamma flip agora vêm direto do calculateGex(),
  // não de uma reconta local — única fonte de verdade por campo (REGRA 00).
  const totalCallGex = useMemo(() => Math.round(gexResult.totalCallGex * 100) / 100, [gexResult]);
  // totalPutGex no motor é armazenado negativo (convenção de "GEX vendido pelo MM");
  // a UI aqui sempre exibiu a magnitude positiva, então aplicamos Math.abs().
  const totalPutGex = useMemo(() => Math.round(Math.abs(gexResult.totalPutGex) * 100) / 100, [gexResult]);
  const netGexTotal = useMemo(() => Math.round(gexResult.totalNetGex * 100) / 100, [gexResult]);

  // Nota: maxGexMagnetStrike do motor ranqueia por magnitude BRUTA (|call|+|put|),
  // enquanto a versão local anterior ranqueava por magnitude do GEX LÍQUIDO por strike.
  // São definições diferentes de "strike mais relevante"; adotamos a do motor testado
  // por ser a fonte única e documentada (ver gex-engine.ts).
  const maxGexStrike = useMemo(() => gexResult.maxGexMagnetStrike, [gexResult]);

  const zeroGammaFlip = useMemo(() => Math.round(gexResult.zeroGammaFlip * 100) / 100, [gexResult]);

  const maxPain = useMemo(() => {
    let minLoss = Infinity;
    let bestK = spotPrice;
    strikesData.forEach(target => {
      let totalLoss = 0;
      strikesData.forEach(s => {
        if (target.strike > s.strike) {
          totalLoss += (target.strike - s.strike) * s.callOi;
        } else if (target.strike < s.strike) {
          totalLoss += (s.strike - target.strike) * s.putOi;
        }
      });
      if (totalLoss < minLoss) {
        minLoss = totalLoss;
        bestK = target.strike;
      }
    });
    return bestK;
  }, [strikesData, spotPrice]);

  const topCallWalls = useMemo(() => {
    return [...strikesData].sort((a, b) => b.callGex - a.callGex).slice(0, 5);
  }, [strikesData]);

  const topPutWalls = useMemo(() => {
    return [...strikesData].sort((a, b) => Math.abs(b.putGex) - Math.abs(a.putGex)).slice(0, 5);
  }, [strikesData]);

  const chartW = 850;
  const chartH = 260;
  const padL = 45;
  const padR = 25;
  const padT = 30;
  const padB = 40;
  const graphW = chartW - padL - padR;
  const graphH = chartH - padT - padB;

  const minStrike = strikesData[0]?.strike || 100;
  const maxStrike = strikesData[strikesData.length - 1]?.strike || 200;
  const strikeRange = Math.max(1, maxStrike - minStrike);

  const getX = (strike: number) => padL + ((strike - minStrike) / strikeRange) * graphW;

  const maxGexAbs = useMemo(() => {
    let m = 0.5;
    strikesData.forEach(s => {
      m = Math.max(m, Math.abs(s.callGex), Math.abs(s.putGex), Math.abs(s.netGex));
    });
    return m * 1.15;
  }, [strikesData]);

  const getY_Gex = (val: number) => {
    const yCenter = padT + graphH / 2;
    return yCenter - (val / maxGexAbs) * (graphH / 2);
  };

  const spotX = getX(spotPrice);
  const flipX = getX(zeroGammaFlip);

  return (
    <div className="space-y-6">
      
      {/* Top Back Navigation Bar */}
      {!isEmbedded && (onBackToQuote || onBackToScreener) && (
        <div className="bg-[#0c1322] border border-gray-800 p-3.5 rounded-2xl flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {onBackToQuote && (
              <button
                onClick={() => onBackToQuote(symbol)}
                className="px-3.5 py-1.5 bg-[#070b14] hover:bg-gray-800 text-cyan-400 border border-cyan-500/30 rounded-xl text-xs font-mono font-bold transition flex items-center gap-1.5 shadow-sm"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Voltar para Consulta ({symbol})</span>
              </button>
            )}

            {onBackToScreener && (
              <button
                onClick={onBackToScreener}
                className="px-3.5 py-1.5 bg-[#070b14] hover:bg-gray-800 text-gray-300 border border-gray-800 rounded-xl text-xs font-mono transition flex items-center gap-1.5"
              >
                <span>Rastreador de Tendências</span>
              </button>
            )}
          </div>

          <div className="text-xs font-mono text-gray-400">
            Ativo em Análise: <strong className="text-white">{symbol}</strong> • Spot: <strong className="text-cyan-400"><DataValue variant="inline" value={spotPrice} format="currency" provenance="ESTIMADO" source="US_STOCKS_DATASET (catálogo estático)" /></strong>
          </div>
        </div>
      )}

      {/* 1. Header do Painel Unificado & Grade de Vencimentos */}
      <div className="bg-[#0c1322] border border-cyan-500/30 p-5 rounded-2xl space-y-4 shadow-xl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-gray-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center">
              <Layers className="w-4 h-4 text-cyan-300" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-white font-mono uppercase tracking-tight">
                  PAINEL UNIFICADO: BARREIRAS DE OI & MOTOR GEX
                </h3>
                <span className="px-1.5 py-0.5 text-[9px] font-bold font-mono rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  PRO-GEX v3.0
                </span>
                <span
                  className="px-2 py-0.5 text-[11px] font-bold font-mono rounded bg-amber-500/30 text-amber-200 border border-amber-500/60"
                  title="Open Interest, gamma e IV desta grade são gerados por modelo paramétrico interno a partir do preço à vista — a API oficial da Tastytrade não entrega esses campos hoje. Não representa posicionamento real de mercado."
                >
                  ⚠ MODELO CALIBRADO — NÃO É DADO DE MERCADO REAL
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                Visualização simultânea da exposição gama dos formadores de mercado (MM), barreiras de Open Interest e Volatility Skew.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1 bg-[#070b14] p-1 rounded-xl border border-gray-800 text-xs font-mono">
            <button
              onClick={() => setDisplayMode('UNIFIED')}
              className={`px-2.5 py-1 rounded-lg transition ${
                displayMode === 'UNIFIED' ? 'bg-cyan-600 text-white font-bold shadow' : 'text-gray-400 hover:text-white'
              }`}
            >
              Tudo Unificado
            </button>
            <button
              onClick={() => setDisplayMode('GEX_ONLY')}
              className={`px-2.5 py-1 rounded-lg transition ${
                displayMode === 'GEX_ONLY' ? 'bg-cyan-600 text-white font-bold shadow' : 'text-gray-400 hover:text-white'
              }`}
            >
              Motor GEX
            </button>
            <button
              onClick={() => setDisplayMode('WALLS_ONLY')}
              className={`px-2.5 py-1 rounded-lg transition ${
                displayMode === 'WALLS_ONLY' ? 'bg-cyan-600 text-white font-bold shadow' : 'text-gray-400 hover:text-white'
              }`}
            >
              Barreiras (OI)
            </button>
            <button
              onClick={() => setDisplayMode('SKEW_ONLY')}
              className={`px-2.5 py-1 rounded-lg transition ${
                displayMode === 'SKEW_ONLY' ? 'bg-cyan-600 text-white font-bold shadow' : 'text-gray-400 hover:text-white'
              }`}
            >
              Vol Skew
            </button>
          </div>
        </div>

        {/* Grade de Vencimentos Oficiais Tastytrade */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs text-gray-300 font-mono">
            <Calendar className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-gray-400">Grade de Vencimentos Oficiais (DTEs Reais Tastytrade):</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {availableExpirations.map((exp) => (
              <button
                key={exp.id}
                onClick={() => setSelectedExpId(exp.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono font-medium transition-all flex items-center gap-1.5 border ${
                  selectedExpId === exp.id
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/60 shadow-md font-bold'
                    : 'bg-[#070b14] text-gray-400 border-gray-800 hover:text-white hover:border-gray-700'
                }`}
              >
                <span>{exp.dateStr}</span>
                {exp.isLiquid && (
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
                )}
              </button>
            ))}
          </div>

          <div className="text-[11px] font-mono text-cyan-400 pt-1">
            Série Ativa: <strong>{currentExp.dateStr}</strong> • Base IV: <strong><DataValue variant="inline" value={currentExp.baseIv} format="percent" provenance="ESTIMADO" source="Modelo paramétrico interno de GEX (sem OI/gamma/IV reais da Tastytrade)" /></strong> • Tipo: <strong>{currentExp.type}</strong>
          </div>
        </div>

        {/* 6 Cartões Métricos */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs font-mono">
          <div className="p-3 bg-[#070b14] border border-gray-800 rounded-xl space-y-1">
            <span className="text-[10px] text-gray-400 block font-sans">Preço Spot ({symbol})</span>
            <DataValue variant="inline" value={spotPrice} format="currency" provenance="ESTIMADO" source="US_STOCKS_DATASET (catálogo estático)" className="text-base font-bold text-white block" />
            <span className="text-[10px] text-cyan-400 font-bold">{symbol}</span>
          </div>

          <div className="p-3 bg-[#070b14] border border-gray-800 rounded-xl space-y-1">
            <span className="text-[10px] text-gray-400 block font-sans">Total Call GEX</span>
            <span className="text-base font-bold text-emerald-400 block">
              +$<DataValue variant="inline" value={totalCallGex} format="number" provenance="ESTIMADO" source="Modelo paramétrico interno de GEX (sem OI/gamma/IV reais da Tastytrade)" />M
            </span>
            <span className="text-[10px] text-emerald-400/80 font-sans">Força Compradora MM</span>
          </div>

          <div className="p-3 bg-[#070b14] border border-gray-800 rounded-xl space-y-1">
            <span className="text-[10px] text-gray-400 block font-sans">Total Put GEX</span>
            <span className="text-base font-bold text-rose-400 block">
              -$<DataValue variant="inline" value={totalPutGex} format="number" provenance="ESTIMADO" source="Modelo paramétrico interno de GEX (sem OI/gamma/IV reais da Tastytrade)" />M
            </span>
            <span className="text-[10px] text-rose-400/80 font-sans">Hedge Vendedor MM</span>
          </div>

          <div className="p-3 bg-[#070b14] border border-gray-800 rounded-xl space-y-1">
            <span className="text-[10px] text-gray-400 block font-sans">Net GEX Regime</span>
            <span className={`text-base font-bold block ${netGexTotal >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {netGexTotal >= 0 ? '+GEX' : '-GEX'} ($<DataValue variant="inline" value={netGexTotal} format="number" provenance="ESTIMADO" source="Modelo paramétrico interno de GEX (sem OI/gamma/IV reais da Tastytrade)" />M)
            </span>
            <span className="text-[10px] text-gray-400 font-sans">
              {netGexTotal >= 0 ? 'Vol Suprimida' : 'Vol Acelerada'}
            </span>
          </div>

          <div className="p-3 bg-[#070b14] border border-gray-800 rounded-xl space-y-1">
            <span className="text-[10px] text-gray-400 block font-sans">Zero Gamma Flip</span>
            <DataValue variant="inline" value={zeroGammaFlip} format="currency" provenance="ESTIMADO" source="Modelo paramétrico interno de GEX (sem OI/gamma/IV reais da Tastytrade)" className="text-base font-bold text-purple-400 block" />
            <span className="text-[10px] text-purple-400/80 font-sans">Ponto de Transição</span>
          </div>

          <div className="p-3 bg-[#070b14] border border-gray-800 rounded-xl space-y-1">
            <span className="text-[10px] text-gray-400 block font-sans">Max GEX Magnet</span>
            <DataValue variant="inline" value={maxGexStrike} format="currency" provenance="ESTIMADO" source="Modelo paramétrico interno de GEX (sem OI/gamma/IV reais da Tastytrade)" className="text-base font-bold text-cyan-400 block" />
            <span className="text-[10px] text-cyan-400/80 font-sans">Ímã de Pinning</span>
          </div>
        </div>
      </div>

      {/* 2. GRÁFICO DE GAMMA EXPOSURE (GEX POR STRIKE) */}
      {(displayMode === 'UNIFIED' || displayMode === 'GEX_ONLY') && (
        <div className="bg-[#0c1322] border border-gray-800 p-5 rounded-2xl space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-gray-800 pb-3">
            <div>
              <h4 className="text-sm font-bold text-white font-mono uppercase flex items-center gap-2">
                <Zap className="w-4 h-4 text-cyan-400" />
                <span>DASHBOARD DE GAMMA EXPOSURE (GEX POR STRIKE)</span>
              </h4>
              <p className="text-xs text-gray-400 mt-0.5">
                Exposição gama estimada em $ Milhões por strike para o vencimento de <strong>{currentExp.label}</strong> (<DataValue variant="inline" value={currentExp.dte} format="number" provenance="ESTIMADO" source="TASTYTRADE_EXPIRATIONS (catálogo de vencimentos)" /> DTE).
              </p>
            </div>

            <div className="flex items-center gap-1.5 bg-[#070b14] p-1 rounded-xl border border-gray-800 text-xs font-mono">
              <button
                onClick={() => setGexSubView('calls_vs_puts')}
                className={`px-2 py-0.5 rounded-lg ${gexSubView === 'calls_vs_puts' ? 'bg-cyan-600 text-white font-bold' : 'text-gray-400 hover:text-white'}`}
              >
                Calls vs Puts
              </button>
              <button
                onClick={() => setGexSubView('net_gex')}
                className={`px-2 py-0.5 rounded-lg ${gexSubView === 'net_gex' ? 'bg-cyan-600 text-white font-bold' : 'text-gray-400 hover:text-white'}`}
              >
                Net GEX
              </button>
              <button
                onClick={() => setGexSubView('abs_gex')}
                className={`px-2 py-0.5 rounded-lg ${gexSubView === 'abs_gex' ? 'bg-cyan-600 text-white font-bold' : 'text-gray-400 hover:text-white'}`}
              >
                Absolute GEX
              </button>
            </div>
          </div>

          {/* SVG Vertical Bars GEX Chart */}
          <div className="w-full bg-[#040711] p-3 rounded-xl border border-gray-900 overflow-hidden relative">
            <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-auto">
              <line
                x1={padL}
                y1={getY_Gex(0)}
                x2={chartW - padR}
                y2={getY_Gex(0)}
                stroke="#334155"
                strokeWidth="1.5"
              />

              <line
                x1={spotX}
                y1={padT}
                x2={spotX}
                y2={chartH - padB}
                stroke="#06b6d4"
                strokeWidth="1.5"
                strokeDasharray="4 4"
              />
              <text
                x={spotX}
                y={padT - 4}
                textAnchor="middle"
                fill="#22d3ee"
                fontSize="9"
                fontWeight="bold"
                fontFamily="monospace"
              >
                Spot <DataValue variant="inline" as="tspan" value={spotPrice} format="currency" provenance="ESTIMADO" source="US_STOCKS_DATASET (catálogo estático)" />
              </text>

              <line
                x1={flipX}
                y1={padT + 12}
                x2={flipX}
                y2={chartH - padB}
                stroke="#c084fc"
                strokeWidth="1.5"
                strokeDasharray="3 3"
              />
              <text
                x={flipX}
                y={padT + 8}
                textAnchor="middle"
                fill="#c084fc"
                fontSize="8.5"
                fontWeight="bold"
                fontFamily="monospace"
              >
                Flip <DataValue variant="inline" as="tspan" value={zeroGammaFlip} format="currency" provenance="ESTIMADO" source="Modelo paramétrico interno de GEX (sem OI/gamma/IV reais da Tastytrade)" />
              </text>

              {strikesData.map((s) => {
                const x = getX(s.strike);
                const barWidth = Math.max(6, graphW / strikesData.length - 4);

                if (gexSubView === 'calls_vs_puts') {
                  const yCall = getY_Gex(s.callGex);
                  const yZero = getY_Gex(0);
                  const hCall = Math.max(2, yZero - yCall);

                  const yPut = getY_Gex(0);
                  const hPut = Math.max(2, getY_Gex(s.putGex) - yZero);

                  return (
                    <g key={s.strike} className="transition-all hover:opacity-80">
                      {s.callGex > 0 && (
                        <rect
                          x={x - barWidth / 2}
                          y={yCall}
                          width={barWidth}
                          height={hCall}
                          fill="#10b981"
                          rx="2"
                        />
                      )}
                      {s.putGex < 0 && (
                        <rect
                          x={x - barWidth / 2}
                          y={yPut}
                          width={barWidth}
                          height={hPut}
                          fill="#f43f5e"
                          rx="2"
                        />
                      )}
                      <text
                        x={x}
                        y={chartH - padB + 14}
                        textAnchor="middle"
                        fill="#64748b"
                        fontSize="7.5"
                        fontFamily="monospace"
                      >
                        <DataValue variant="inline" as="tspan" value={s.strike} format="number" provenance="ESTIMADO" source="Modelo paramétrico interno de GEX (sem OI/gamma/IV reais da Tastytrade)" />
                      </text>
                    </g>
                  );
                } else if (gexSubView === 'net_gex') {
                  const isPos = s.netGex >= 0;
                  const yBar = isPos ? getY_Gex(s.netGex) : getY_Gex(0);
                  const hBar = Math.max(2, Math.abs(getY_Gex(s.netGex) - getY_Gex(0)));

                  return (
                    <g key={s.strike}>
                      <rect
                        x={x - barWidth / 2}
                        y={yBar}
                        width={barWidth}
                        height={hBar}
                        fill={isPos ? '#10b981' : '#f43f5e'}
                        rx="2"
                      />
                      <text
                        x={x}
                        y={chartH - padB + 14}
                        textAnchor="middle"
                        fill="#64748b"
                        fontSize="7.5"
                        fontFamily="monospace"
                      >
                        <DataValue variant="inline" as="tspan" value={s.strike} format="number" provenance="ESTIMADO" source="Modelo paramétrico interno de GEX (sem OI/gamma/IV reais da Tastytrade)" />
                      </text>
                    </g>
                  );
                } else {
                  const absVal = Math.abs(s.callGex) + Math.abs(s.putGex);
                  const yBar = getY_Gex(absVal);
                  const hBar = Math.max(2, getY_Gex(0) - yBar);

                  return (
                    <g key={s.strike}>
                      <rect
                        x={x - barWidth / 2}
                        y={yBar}
                        width={barWidth}
                        height={hBar}
                        fill="#06b6d4"
                        rx="2"
                      />
                      <text
                        x={x}
                        y={chartH - padB + 14}
                        textAnchor="middle"
                        fill="#64748b"
                        fontSize="7.5"
                        fontFamily="monospace"
                      >
                        <DataValue variant="inline" as="tspan" value={s.strike} format="number" provenance="ESTIMADO" source="Modelo paramétrico interno de GEX (sem OI/gamma/IV reais da Tastytrade)" />
                      </text>
                    </g>
                  );
                }
              })}
            </svg>

            <div className="flex justify-between items-center text-[10px] text-gray-400 font-mono px-2 pt-1 border-t border-gray-900">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-sm bg-emerald-500"></span> Call GEX (Exposição Positiva)
                <span className="w-2 h-2 rounded-sm bg-rose-500 ml-2"></span> Put GEX (Exposição Negativa)
              </span>
              <span className="text-gray-400">Strikes ($)</span>
            </div>
          </div>
        </div>
      )}

      {/* 3. DISTRIBUIÇÃO DE VOLUME & OPEN INTEREST */}
      {(displayMode === 'UNIFIED' || displayMode === 'WALLS_ONLY') && (
        <div className="bg-[#0c1322] border border-gray-800 p-5 rounded-2xl space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-gray-800 pb-3">
            <div>
              <h4 className="text-sm font-bold text-white font-mono uppercase flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-emerald-400" />
                <span>DISTRIBUIÇÃO DE VOLUME & OPEN INTEREST POR STRIKE</span>
              </h4>
              <p className="text-xs text-gray-400 mt-0.5">
                Paredes de contratos institucionais abertos para {currentExp.dateStr}.
              </p>
            </div>
            <div className="text-xs font-mono text-cyan-300 bg-[#070b14] px-3 py-1 rounded-lg border border-gray-800">
              Max Pain: <strong><DataValue variant="inline" value={maxPain} format="currency" provenance="ESTIMADO" source="Modelo paramétrico interno de GEX (sem OI/gamma/IV reais da Tastytrade)" /></strong>
            </div>
          </div>

          {/* Gráfico Bi-direcional Espelhado Horizontal */}
          <div className="space-y-1 bg-[#040711] p-4 rounded-xl border border-gray-900">
            <div className="grid grid-cols-12 text-[10px] font-mono text-gray-400 pb-2 border-b border-gray-800 text-center">
              <div className="col-span-5 text-right pr-4 text-rose-400 font-bold">PUT OPEN INTEREST (CONTRATOS)</div>
              <div className="col-span-2 text-center text-white font-bold">STRIKE</div>
              <div className="col-span-5 text-left pl-4 text-emerald-400 font-bold">CALL OPEN INTEREST (CONTRATOS)</div>
            </div>

            {strikesData.slice(4, 21).map((s) => {
              const maxOiForScale = 55000;
              const putPct = Math.min(100, (s.putOi / maxOiForScale) * 100);
              const callPct = Math.min(100, (s.callOi / maxOiForScale) * 100);
              const isAtm = Math.abs(s.strike - spotPrice) < 2.5;
              const isMaxPain = s.strike === maxPain;

              return (
                <div key={s.strike} className={`grid grid-cols-12 items-center text-xs font-mono py-1 rounded ${isAtm ? 'bg-cyan-950/30' : ''}`}>
                  <div className="col-span-5 flex items-center justify-end gap-2 pr-4">
                    <span className="text-[10px] text-gray-400">{s.putOi.toLocaleString()}</span>
                    <div className="w-32 bg-[#0d1527] h-3 rounded overflow-hidden flex justify-end">
                      <div
                        className="bg-gradient-to-l from-rose-500 to-rose-700 h-full rounded-l"
                        style={{ width: `${putPct}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="col-span-2 text-center">
                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                      isAtm 
                        ? 'bg-cyan-500 text-slate-950 shadow-sm' 
                        : isMaxPain
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'text-gray-300'
                    }`}>
                      <DataValue variant="inline" value={s.strike} format="currency" provenance="ESTIMADO" source="Modelo paramétrico interno de GEX (sem OI/gamma/IV reais da Tastytrade)" />
                    </span>
                  </div>

                  <div className="col-span-5 flex items-center justify-start gap-2 pl-4">
                    <div className="w-32 bg-[#0d1527] h-3 rounded overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-emerald-500 to-cyan-500 h-full rounded-r"
                        style={{ width: `${callPct}%` }}
                      ></div>
                    </div>
                    <span className="text-[10px] text-gray-400">{s.callOi.toLocaleString()}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Tabelas de Top 5 Call Walls e Put Walls */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs font-mono">
            <div className="bg-[#070b14] border border-emerald-500/20 rounded-xl p-3.5 space-y-2">
              <div className="flex justify-between items-center text-emerald-400 font-bold border-b border-gray-800 pb-1.5">
                <span>Top 5 Call Walls (Resistência Estimada)</span>
                <span className="text-[10px] text-gray-400">Total OI</span>
              </div>
              <div className="space-y-1.5">
                {topCallWalls.map((w, idx) => (
                  <div key={w.strike} className="flex justify-between items-center text-gray-300 bg-[#0c1322] p-2 rounded-lg">
                    <div className="flex items-center gap-2">
                      {/* eslint-disable-next-line local-rules/no-raw-numbers-in-jsx -- indice de posicao ordinal no ranking Top 5 das barreiras (rotulo de UI) */}
                      <span className="text-emerald-400 font-bold">#{idx + 1}</span>
                      <span><DataValue variant="inline" value={w.strike} format="currency" provenance="ESTIMADO" source="Modelo paramétrico interno de GEX (sem OI/gamma/IV reais da Tastytrade)" /></span>
                      <span className="text-[10px] text-gray-400">{w.callSymbol}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-emerald-400 font-bold">{w.callOi.toLocaleString()} OI</span>
                      <span className="text-[10px] text-gray-400">
                        IV: <DataValue variant="inline" value={w.callIv} format="percent" provenance="ESTIMADO" source="Modelo paramétrico interno de GEX (sem OI/gamma/IV reais da Tastytrade)" />
                      </span>
                      <span className="text-[10px] text-cyan-400">
                        <DataValue variant="inline" value={((w.strike - spotPrice) / spotPrice) * 100} format="percent" provenance="ESTIMADO" source="Modelo paramétrico interno de GEX (sem OI/gamma/IV reais da Tastytrade)" />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[#070b14] border border-rose-500/20 rounded-xl p-3.5 space-y-2">
              <div className="flex justify-between items-center text-rose-400 font-bold border-b border-gray-800 pb-1.5">
                <span>Top 5 Put Walls (Suporte Estimado)</span>
                <span className="text-[10px] text-gray-400">Total OI</span>
              </div>
              <div className="space-y-1.5">
                {topPutWalls.map((w, idx) => (
                  <div key={w.strike} className="flex justify-between items-center text-gray-300 bg-[#0c1322] p-2 rounded-lg">
                    <div className="flex items-center gap-2">
                      {/* eslint-disable-next-line local-rules/no-raw-numbers-in-jsx -- indice de posicao ordinal no ranking Top 5 das barreiras (rotulo de UI) */}
                      <span className="text-rose-400 font-bold">#{idx + 1}</span>
                      <span><DataValue variant="inline" value={w.strike} format="currency" provenance="ESTIMADO" source="Modelo paramétrico interno de GEX (sem OI/gamma/IV reais da Tastytrade)" /></span>
                      <span className="text-[10px] text-gray-400">{w.putSymbol}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-rose-400 font-bold">{w.putOi.toLocaleString()} OI</span>
                      <span className="text-[10px] text-gray-400">
                        IV: <DataValue variant="inline" value={w.putIv} format="percent" provenance="ESTIMADO" source="Modelo paramétrico interno de GEX (sem OI/gamma/IV reais da Tastytrade)" />
                      </span>
                      <span className="text-[10px] text-rose-400">
                        <DataValue variant="inline" value={((w.strike - spotPrice) / spotPrice) * 100} format="percent" provenance="ESTIMADO" source="Modelo paramétrico interno de GEX (sem OI/gamma/IV reais da Tastytrade)" />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. IMPLIED VOLATILITY SKEW */}
      {(displayMode === 'UNIFIED' || displayMode === 'SKEW_ONLY') && (
        <div className="bg-[#0c1322] border border-gray-800 p-5 rounded-2xl space-y-4 shadow-xl">
          <div className="flex justify-between items-center border-b border-gray-800 pb-3">
            <div>
              <h4 className="text-sm font-bold text-white font-mono uppercase flex items-center gap-2">
                <Activity className="w-4 h-4 text-purple-400" />
                <span>IMPLIED VOLATILITY SKEW (SMILE DE VOLATILIDADE)</span>
              </h4>
              <p className="text-xs text-gray-400 mt-0.5">
                Curva de precificação de volatilidade implícita ao longo de todos os strikes para {currentExp.dateStr}.
              </p>
            </div>
            <div className="text-xs font-mono text-purple-300">
              ATM IV: <strong><DataValue variant="inline" value={currentExp.baseIv} format="percent" provenance="ESTIMADO" source="Modelo paramétrico interno de GEX (sem OI/gamma/IV reais da Tastytrade)" /></strong>
            </div>
          </div>

          <div className="w-full bg-[#040711] p-3 rounded-xl border border-gray-900 overflow-hidden relative">
            <svg viewBox="0 0 850 180" className="w-full h-auto">
              <line x1={spotX} y1={20} x2={spotX} y2={145} stroke="#06b6d4" strokeWidth="1.5" strokeDasharray="4 4" />
              <text x={spotX} y={15} textAnchor="middle" fill="#22d3ee" fontSize="9" fontWeight="bold" fontFamily="monospace">
                Spot <DataValue variant="inline" as="tspan" value={spotPrice} format="currency" provenance="ESTIMADO" source="US_STOCKS_DATASET (catálogo estático)" />
              </text>

              {strikesData.map((s, idx) => {
                if (idx === strikesData.length - 1) return null;
                const nextS = strikesData[idx + 1];
                const x1 = getX(s.strike);
                const x2 = getX(nextS.strike);
                const yCall1 = 140 - (s.callIv - 25) * 4;
                const yCall2 = 140 - (nextS.callIv - 25) * 4;
                const yPut1 = 140 - (s.putIv - 25) * 4;
                const yPut2 = 140 - (nextS.putIv - 25) * 4;

                return (
                  <g key={s.strike}>
                    <line x1={x1} y1={yCall1} x2={x2} y2={yCall2} stroke="#10b981" strokeWidth="2.5" />
                    <line x1={x1} y1={yPut1} x2={x2} y2={yPut2} stroke="#f43f5e" strokeWidth="2.5" />
                  </g>
                );
              })}
            </svg>

            <div className="flex justify-between items-center text-[10px] text-gray-400 font-mono px-2 pt-1 border-t border-gray-900">
              <span className="flex items-center gap-2">
                <span className="text-emerald-400 font-bold">― Call IV (%)</span>
                <span className="text-rose-400 font-bold">― Put IV (%)</span>
              </span>
              <span>Strikes ($)</span>
            </div>
          </div>
        </div>
      )}

      {/* 5. PAINEL INSTITUCIONAL: PILARES OPERACIONAIS DO GEX */}
      <div className="bg-[#0c1322] border border-cyan-500/40 rounded-2xl p-6 space-y-5 shadow-2xl">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-gray-800 pb-3">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-cyan-400" />
            <div>
              <h4 className="text-sm font-bold text-white font-mono uppercase tracking-tight">
                Diretrizes Operacionais do Modelo de GEX (GEX Engine)
              </h4>
              <p className="text-xs text-gray-400 mt-0.5 font-sans">
                O GEX não é análise técnica subjetiva — é a derivada de 2ª ordem que obriga os Market Makers ao Delta Hedging.
              </p>
            </div>
          </div>
          <span className="px-3 py-1 bg-cyan-950 text-cyan-300 border border-cyan-500/40 rounded-xl text-xs font-mono font-bold">
            Fórmula: GEX = Γ × OI × Spot² × 100
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono">
          <div className="p-3.5 bg-[#070b14] border border-emerald-500/30 rounded-xl space-y-1">
            <span className="text-[10px] text-emerald-400 font-bold block font-sans">1. RESISTÊNCIA (CALL WALL)</span>
            <DataValue variant="inline" value={topCallWalls[0]?.strike ?? null} format="currency" provenance="ESTIMADO" source="Modelo paramétrico interno de GEX (sem OI/gamma/IV reais da Tastytrade)" className="text-base font-bold text-white block" unavailableLabel="—" />
            <span className="text-[10px] text-gray-400 block font-sans">Ímã de alta & trava de balanceamento dos MMs.</span>
          </div>

          <div className="p-3.5 bg-[#070b14] border border-rose-500/30 rounded-xl space-y-1">
            <span className="text-[10px] text-rose-400 font-bold block font-sans">2. SUPORTE (PUT WALL)</span>
            <DataValue variant="inline" value={topPutWalls[0]?.strike ?? null} format="currency" provenance="ESTIMADO" source="Modelo paramétrico interno de GEX (sem OI/gamma/IV reais da Tastytrade)" className="text-base font-bold text-white block" unavailableLabel="—" />
            <span className="text-[10px] text-gray-400 block font-sans">Ímã de baixa & barreira matemática dos MMs.</span>
          </div>

          <div className="p-3.5 bg-[#070b14] border border-amber-500/30 rounded-xl space-y-1">
            <span className="text-[10px] text-amber-400 font-bold block font-sans">3. PIN CANDIDATE (ESCAPE OI)</span>
            <DataValue variant="inline" value={maxPain} format="currency" provenance="ESTIMADO" source="Modelo paramétrico interno de GEX (sem OI/gamma/IV reais da Tastytrade)" className="text-base font-bold text-amber-300 block" />
            <span className="text-[10px] text-gray-400 block font-sans">Ponto de fuga secundário quando as Walls falham.</span>
          </div>

          <div className="p-3.5 bg-[#070b14] border border-purple-500/30 rounded-xl space-y-1">
            <span className="text-[10px] text-purple-400 font-bold block font-sans">4. ZERO GAMMA FLIP</span>
            <DataValue variant="inline" value={zeroGammaFlip} format="currency" provenance="ESTIMADO" source="Modelo paramétrico interno de GEX (sem OI/gamma/IV reais da Tastytrade)" className="text-base font-bold text-purple-300 block" />
            <span className="text-[10px] text-gray-400 block font-sans">Gatilho de transição entre Supressão e Squeeze.</span>
          </div>
        </div>

        <div className="p-4 bg-[#070b14] border border-gray-800 rounded-xl space-y-3 font-sans text-xs">
          <h5 className="font-bold text-white flex items-center gap-2">
            <Shield className="w-4 h-4 text-cyan-400" />
            <span>Checklist Pré-Operacional do Trader Quantitativo:</span>
          </h5>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] text-gray-300">
            <div className="p-2.5 bg-[#111827] rounded-lg border border-gray-800 space-y-1">
              <strong className="text-cyan-300 block font-mono">1. Localizar Call Wall e Put Wall:</strong>
              Ponderadas pela sensibilidade Gamma real (descarte leituras de OI puro estático).
            </div>

            <div className="p-2.5 bg-[#111827] rounded-lg border border-gray-800 space-y-1">
              <strong className="text-cyan-300 block font-mono">2. Diagnóstico de Encavalamento:</strong>
              {Math.abs(topCallWalls[0]?.strike - topPutWalls[0]?.strike) < spotPrice * 0.05
                ? '⚠ Walls encavaladas -> Viés de Consolidação (Montar Iron Condor e colher teta).'
                : '✓ Walls abertas -> Espaço para expansão direcional ou Straddles.'}
            </div>

            <div className="p-2.5 bg-[#111827] rounded-lg border border-gray-800 space-y-1">
              <strong className="text-cyan-300 block font-mono">3. Gatilho Sniper no Primeiro Toque:</strong>
              No 1º toque na Wall, o preço quase nunca rompe; atue na exaustão buscando reversão à média.
            </div>

            <div className="p-2.5 bg-[#111827] rounded-lg border border-gray-800 space-y-1">
              <strong className="text-cyan-300 block font-mono">4. Mercado Americano (Custo até 50%):</strong>
              Em travas de débito (Bull/Bear Spreads), pague no máximo 50% da largura da asa (vs 25%-30% no Brasil).
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}