'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { DataValue } from '@/components/shared/DataValue';
import { ProvenanceBadge, ProvenanceValue } from '@/lib/types/provenance';
import {
  ScreenerCandidateStatus,
  ScreenerRejectionStage,
} from '@/lib/types/low-vol-screener.types';
import { 
  CheckCircle2, 
  ShieldCheck, 
  Layers, 
  TrendingDown, 
  ChevronDown, 
  ChevronUp, 
  BookOpen,
  Clock,
  AlertCircle
} from 'lucide-react';

interface ExpirationData {
  expirationDate: string;
  dte: number;
  selectionRule: string;
  bufferDaysApplied: number;
  isMonthlyStandard: boolean;
  provenance: ProvenanceBadge;
  source: string;
}

interface OptionLegData {
  symbol: string;
  strike: number;
  optionType: 'CALL' | 'PUT';
  action?: 'BUY' | 'SELL';
  isAtm: boolean;
  bid: number;
  ask: number;
  mid: number;
  relativeSpread: number;
  openInterest: number;
  passesLiquidity: boolean;
  delta?: ProvenanceValue<number>;
  provenance: ProvenanceBadge;
  source: string;
}

interface ApprovedStrategy {
  symbol: string;
  sector: string;
  structureType: 'STRANGLE' | 'STRADDLE';
  positionDirection?: 'LONG';
  selectedExpiration: ExpirationData;
  callLeg: OptionLegData;
  putLeg: OptionLegData;
  totalDebitMid?: number;
  totalCreditMid?: number;
  provenance: ProvenanceBadge;
}

interface DetailedEvaluation {
  symbol: string;
  sector: string;
  status: ScreenerCandidateStatus;
  rejectionStage: ScreenerRejectionStage | null;
  rejectionCode: string | null;
  rejectionReason: string | null;
  layer0: {
    spotPrice?: ProvenanceValue<number>;
    passesPriceThreshold?: boolean;
    hv12m: ProvenanceValue<number>;
    hv12mTrimmed: ProvenanceValue<number>;
    hvDropRatio: ProvenanceValue<number>;
    hv12mPercentile: ProvenanceValue<number>;
    passesHvPercentile: boolean;
    passesStability: boolean;
    sectorQuotaApproved: boolean;
  };
  layer1: {
    bbwCurrent: ProvenanceValue<number>;
    bbwHistoryPercentile: ProvenanceValue<number>;
    passesSqueeze: boolean;
  } | null;
  layer2: {
    ivRank: ProvenanceValue<number>;
    ivPercentile: ProvenanceValue<number>;
    passesIvFilter: boolean;
    selectedExpiration: ExpirationData;
  } | null;
}

interface ShadowRunPayload {
  runId: string;
  executedAt: string;
  marketSession: string;
  universeSize: number;
  funnelSummary: {
    totalEvaluated: number;
    layer0Approved: number;
    layer1Approved: number;
    layer2Approved: number;
    finalApproved: number;
  };
  approvedStrategies: ApprovedStrategy[];
  detailedEvaluations: DetailedEvaluation[];
}

export function ShadowAuditView() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [availableRuns, setAvailableRuns] = useState<{ filename: string; createdAt: string }[]>([]);
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [runData, setRunData] = useState<ShadowRunPayload | null>(null);

  // Controle de exibição do Instrutivo
  const [showGuide, setShowGuide] = useState(true);

  // Filtros de Tabela
  const [searchSymbol, setSearchSymbol] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | ScreenerCandidateStatus>('ALL');
  const [stageFilter, setStageFilter] = useState<'ALL' | ScreenerRejectionStage>('ALL');

  const fetchRun = async (filename?: string) => {
    setLoading(true);
    setError(null);
    try {
      const url = filename ? `/api/shadow-mode?file=${encodeURIComponent(filename)}` : '/api/shadow-mode';
      const res = await fetch(url);
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Falha ao carregar relatório do Modo Sombra.');
      }

      if (data.availableRuns) {
        setAvailableRuns(data.availableRuns);
      }
      const runPayload: ShadowRunPayload = data.run || data.latestRun;
      setRunData(runPayload);
      if (filename) {
        setSelectedFile(filename);
      } else if (data.availableRuns && data.availableRuns.length > 0) {
        setSelectedFile(data.availableRuns[0].filename);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao buscar dados');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRun();
  }, []);

  const handleRunChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const filename = e.target.value;
    setSelectedFile(filename);
    fetchRun(filename);
  };

  // Filtragem da tabela baseada em tipos exatos do domínio
  const filteredEvaluations = useMemo(() => {
    if (!runData) return [];
    return runData.detailedEvaluations.filter((row) => {
      const matchesSymbol = row.symbol.toLowerCase().includes(searchSymbol.toLowerCase().trim());
      const matchesStatus =
        statusFilter === 'ALL'
          ? true
          : row.status === statusFilter;

      const matchesStage =
        stageFilter === 'ALL'
          ? true
          : row.rejectionStage === stageFilter;

      return matchesSymbol && matchesStatus && matchesStage;
    });
  }, [runData, searchSymbol, statusFilter, stageFilter]);

  if (loading && !runData) {
    return (
      <div className="min-h-[500px] bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-8 rounded-xl border border-zinc-800">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-emerald-500 mb-4"></div>
        <p className="text-zinc-400 font-mono text-sm">Carregando logs de auditoria real do Modo Sombra...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-4 md:p-6 bg-zinc-950 text-zinc-100 rounded-2xl border border-zinc-800/80">
      
      {/* CABEÇALHO */}
      <header className="border-b border-zinc-800 pb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              Screener V1 — Modo Sombra (Paper Trading)
            </span>
            <span className="text-zinc-500 text-xs font-mono">Regra 00: Integridade Real</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white mt-1 flex items-center gap-2">
            <span>Painel de Auditoria Manual &amp; Conferência 1:1</span>
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Auditoria determinística contra a Tastytrade Desktop. Zero números inventados, dados 100% reais persistidos em disco.
          </p>
        </div>

        {/* CONTROLES DO CABEÇALHO */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setShowGuide(!showGuide)}
            className="flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs font-medium px-3 py-2 rounded-lg border border-zinc-700 transition"
          >
            <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
            <span>{showGuide ? 'Ocultar Instrutivo' : 'Como Usar & Lógica'}</span>
            {showGuide ? <ChevronUp className="w-3 h-3 text-zinc-400" /> : <ChevronDown className="w-3 h-3 text-zinc-400" />}
          </button>

          <div className="flex items-center gap-2 bg-zinc-900/90 p-1.5 rounded-lg border border-zinc-800">
            <label className="text-xs text-zinc-400 font-medium pl-2">Ciclo:</label>
            <select
              value={selectedFile}
              onChange={handleRunChange}
              className="bg-zinc-950 border border-zinc-700 text-xs font-mono text-zinc-200 rounded px-2 py-1.5 focus:outline-none focus:border-emerald-500"
            >
              {availableRuns.map((r) => (
                <option key={r.filename} value={r.filename}>
                  {r.filename.replace('shadow-run-', '').replace('.json', '')}
                </option>
              ))}
            </select>
            <button
              onClick={() => fetchRun(selectedFile)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3 py-1.5 rounded transition shadow-sm"
            >
              Atualizar
            </button>
          </div>
        </div>
      </header>

      {/* INSTRUTIVO EXPANSÍVEL: COMO USAR E QUAL A LÓGICA */}
      {showGuide && (
        <section className="bg-zinc-900/70 border border-emerald-500/30 rounded-xl p-5 space-y-4 shadow-lg animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <h2 className="text-base font-bold text-white tracking-wide">
                Instrutivo: Como Usar este Painel e a Lógica do Screener V1
              </h2>
            </div>
            <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-500/30">
              Guia Técnico do Operador
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-xs text-zinc-300">
            
            {/* Bloco 1: A Tese de Mercado */}
            <div className="space-y-2 bg-zinc-950/60 p-3.5 rounded-lg border border-zinc-800">
              <div className="font-bold text-zinc-100 flex items-center gap-1.5">
                <TrendingDown className="w-4 h-4 text-cyan-400" />
                <span>1. Tese: Long Strangle a Débito</span>
              </div>
              <p className="text-zinc-400 leading-relaxed">
                Este sistema busca ativos com volatilidade histórica comprimida (<strong className="text-zinc-200">squeeze</strong>) e volatilidade implícita barata (<strong className="text-zinc-200">IVR/IVP &le; 30</strong>).
              </p>
              <p className="text-zinc-400 leading-relaxed">
                A estrutura eleita é um <strong className="text-emerald-400">Long Strangle (compra de Call OTM + compra de Put OTM)</strong>. A posição opera a <strong className="text-emerald-300">DÉBITO inicial</strong> (custo de entrada reduzido por estar fora do dinheiro), visando lucrar com a expansão de volatilidade e rompimento direcional.
              </p>
            </div>

            {/* Bloco 2: O Funil de 4 Camadas */}
            <div className="space-y-2 bg-zinc-950/60 p-3.5 rounded-lg border border-zinc-800">
              <div className="font-bold text-zinc-100 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-emerald-400" />
                <span>2. As 4 Camadas de Seleção</span>
              </div>
              <ul className="space-y-1.5 text-zinc-400">
                <li>
                  <strong className="text-zinc-200">Camada 0 (HV 12M):</strong> Garman-Klass Percentil &ge; 65%, estabilidade com winsorização 5% (queda &le; 40%) e teto setorial de 25%.
                </li>
                <li>
                  <strong className="text-zinc-200">Camada 1 (Squeeze BBW):</strong> Largura das Bandas de Bollinger (20,2) no percentil &le; 15% da própria série histórica.
                </li>
                <li>
                  <strong className="text-zinc-200">Camada 2 (Confirmação IV):</strong> <code className="text-emerald-400">tos-iv-rank</code> e <code className="text-emerald-400">iv-percentile</code> &le; 30.0 + vencimento de 30-45 DTE.
                </li>
                <li>
                  <strong className="text-zinc-200">Camada 3 (Liquidez):</strong> Bid/Ask spread &le; 10% e Open Interest &ge; 250 em ambas as pernas.
                </li>
              </ul>
            </div>

            {/* Bloco 3: Como Auditar 1:1 contra a Tastytrade */}
            <div className="space-y-2 bg-zinc-950/60 p-3.5 rounded-lg border border-zinc-800">
              <div className="font-bold text-zinc-100 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>3. Conferência 1:1 contra o Terminal</span>
              </div>
              <p className="text-zinc-400 leading-relaxed">
                Abra a plataforma desktop Tastytrade e coloque lado a lado com esta tela:
              </p>
              <ul className="space-y-1 text-zinc-400">
                <li>
                  • <strong className="text-zinc-200">IV Rank:</strong> confira a coluna <code className="text-emerald-400">tos-iv-rank</code> contra o indicador no gráfico inferior da Tastytrade.
                </li>
                <li>
                  • <strong className="text-zinc-200">IV Percentile:</strong> confira a coluna <code className="text-emerald-400">iv-percentile</code> contra o indicador inferior da plataforma.
                </li>
                <li>
                  • <strong className="text-zinc-200">Filtros:</strong> use o dropdown de Status para ver apenas aprovados (<code className="text-emerald-400">APPROVED_FOR_EXECUTION</code>) ou veja o motivo exato de rejeição de cada ativo.
                </li>
              </ul>
            </div>

          </div>
        </section>
      )}

      {error && (
        <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">
          <strong>Erro na auditoria:</strong> {error}
        </div>
      )}

      {runData && (
        <>
          {/* METADADOS DO CICLO */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-lg p-3">
              <div className="text-[11px] text-zinc-400 font-medium uppercase tracking-wider">ID do Ciclo</div>
              <div className="text-xs font-mono text-zinc-200 mt-1 truncate" title={runData.runId}>
                {runData.runId}
              </div>
            </div>
            <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-lg p-3">
              <div className="text-[11px] text-zinc-400 font-medium uppercase tracking-wider">Timestamp UTC</div>
              <div className="text-xs font-mono text-zinc-200 mt-1">
                {new Date(runData.executedAt).toLocaleTimeString()}
              </div>
            </div>
            <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-lg p-3">
              <div className="text-[11px] text-zinc-400 font-medium uppercase tracking-wider">Universo Curado</div>
              <div className="text-lg font-bold text-white mt-0.5">
                {/* eslint-disable-next-line local-rules/no-raw-numbers-in-jsx -- contador visual de ativos do ciclo */}
                {runData.universeSize} ativos
              </div>
            </div>
            <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-lg p-3">
              <div className="text-[11px] text-zinc-400 font-medium uppercase tracking-wider">Passaram Camada 0</div>
              <div className="text-lg font-bold text-zinc-200 mt-0.5">
                {/* eslint-disable-next-line local-rules/no-raw-numbers-in-jsx -- contador visual de aprovados L0 */}
                {runData.funnelSummary.layer0Approved}
              </div>
            </div>
            <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-lg p-3">
              <div className="text-[11px] text-zinc-400 font-medium uppercase tracking-wider">Passaram Camada 1</div>
              <div className="text-lg font-bold text-zinc-200 mt-0.5">
                {/* eslint-disable-next-line local-rules/no-raw-numbers-in-jsx -- contador visual de aprovados L1 */}
                {runData.funnelSummary.layer1Approved}
              </div>
            </div>
            <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-lg p-3">
              <div className="text-[11px] text-emerald-400 font-medium uppercase tracking-wider">Aprovados Finais</div>
              <div className="text-lg font-bold text-emerald-300 mt-0.5">
                {/* eslint-disable-next-line local-rules/no-raw-numbers-in-jsx -- contador visual de aprovados finais */}
                {runData.funnelSummary.finalApproved}
              </div>
            </div>
          </div>

          {/* SEÇÃO DE ESTRUTURAS ELEITAS (DESTAQUE) */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <span>Estruturas Eleitas (Long Strangle — Débito)</span>
                  <span className="text-xs font-normal text-zinc-400 bg-zinc-800/80 px-2 py-0.5 rounded">
                    {/* eslint-disable-next-line local-rules/no-raw-numbers-in-jsx -- rotulo visual de quantidade */}
                    {runData.approvedStrategies.length} selecionada(s)
                  </span>
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Compra de volatilidade com strikes OTM e DTE 30-45d. Posição de <strong>DÉBITO</strong> inicial.
                </p>
              </div>
            </div>

            {runData.approvedStrategies.length === 0 ? (
              <div className="p-8 rounded-xl bg-zinc-900/40 border border-zinc-800 text-center text-zinc-400 text-sm">
                Nenhum ativo aprovado neste ciclo. (Critério de corte preservado integralmente conforme Regra 00).
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {runData.approvedStrategies.map((strat) => {
                  const totalCost = strat.totalDebitMid ?? strat.totalCreditMid ?? 0;
                  return (
                    <div
                      key={strat.symbol}
                      className="bg-zinc-900/90 border border-emerald-500/40 rounded-xl p-5 shadow-xl space-y-4 relative overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 bg-emerald-500 text-zinc-950 text-[10px] font-bold px-3 py-1 rounded-bl-lg uppercase tracking-wider">
                        Long Strangle Eleito
                      </div>

                      {/* Cabeçalho do Ativo */}
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-2xl font-black text-white tracking-wide">{strat.symbol}</span>
                            <DataValue
                              value={strat.symbol}
                              format="raw"
                              provenance={strat.provenance}
                              source="structure-selector-v1"
                              variant="badge"
                            />
                          </div>
                          <div className="text-xs text-zinc-400 mt-0.5">{strat.sector}</div>
                          
                          {/* Timestamp de geração destacado no card */}
                          <div className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-400 mt-2 bg-zinc-950/80 border border-zinc-800 px-2 py-1 rounded w-fit">
                            <Clock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span className="text-zinc-400">Gerado:</span>
                            <span className="text-zinc-200 font-semibold">{runData.executedAt}</span>
                            <DataValue
                              value={runData.executedAt}
                              format="raw"
                              provenance="MEDIDO"
                              source="shadow-run-timestamp"
                              variant="badge"
                            />
                          </div>
                        </div>

                        <div className="text-right pr-20 space-y-1.5">
                          <div>
                            <div className="text-[10px] text-zinc-400 uppercase tracking-wider">Custo Teórico Mid</div>
                            <div className="text-xl font-mono font-bold text-emerald-400">
                              <DataValue
                                value={totalCost}
                                format="currency"
                                provenance={strat.provenance}
                                source="sum-of-bought-leg-mids"
                                variant="inline"
                              />
                              <span className="text-[11px] text-zinc-400 font-normal ml-1">(Débito)</span>
                            </div>
                          </div>

                          <div className="pt-0.5 border-t border-zinc-800/80">
                            <div className="text-[10px] text-zinc-400 uppercase tracking-wider flex items-center justify-end gap-1">
                              <span>% NetLiq Conta</span>
                              <span title="Sessão OAuth2 atual restrita a dados de mercado (Market Data). Endpoints privados de custódia e saldos (/customers/me/accounts) não autorizados nesta credencial (HTTP 401).">
                                <AlertCircle className="w-3 h-3 text-amber-400 inline cursor-help" />
                              </span>
                            </div>
                            <div className="text-xs font-mono font-semibold text-zinc-400">
                              <DataValue
                                value={null}
                                format="percent"
                                provenance="INDISPONIVEL"
                                source="tastytrade-account-balances"
                                variant="inline"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Vencimento Selecionado */}
                      <div className="bg-zinc-950/70 rounded-lg p-3 border border-zinc-800/80 flex items-center justify-between text-xs">
                        <div>
                          <span className="text-zinc-400">Vencimento: </span>
                          <span className="font-mono font-bold text-zinc-100">{strat.selectedExpiration.expirationDate}</span>
                          <span className="ml-2 text-emerald-400 font-mono">
                            {/* eslint-disable-next-line local-rules/no-raw-numbers-in-jsx -- dte de vencimento */}
                            ({strat.selectedExpiration.dte} DTE)
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-mono text-zinc-400 bg-zinc-800 px-1.5 py-0.5 rounded">
                            {strat.selectedExpiration.selectionRule}
                          </span>
                          <DataValue
                            value={strat.selectedExpiration.expirationDate}
                            format="raw"
                            provenance={strat.selectedExpiration.provenance}
                            source={strat.selectedExpiration.source}
                            variant="badge"
                          />
                        </div>
                      </div>

                      {/* Pernas da Opção */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        
                        {/* CALL OTM */}
                        <div className="bg-zinc-950/90 rounded-lg p-3 border border-zinc-800 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold px-1.5 py-0.5 rounded font-mono">
                                CALL (BUY)
                              </span>
                              <span className="text-xs font-bold text-zinc-100">
                                <DataValue
                                  value={strat.callLeg.strike}
                                  format="currency"
                                  provenance={strat.callLeg.provenance}
                                  source={strat.callLeg.source}
                                  variant="inline"
                                />
                              </span>
                              {strat.callLeg.delta ? (
                                <span className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded text-[10px] font-mono">
                                  <span className="text-zinc-400">Δ:</span>
                                  <span className="text-emerald-400 font-bold">
                                    <DataValue
                                      value={strat.callLeg.delta.value}
                                      format="number"
                                      provenance={strat.callLeg.delta.provenance}
                                      source={strat.callLeg.delta.source}
                                      variant="inline"
                                    />
                                  </span>
                                  <DataValue
                                    value={strat.callLeg.delta.value}
                                    format="raw"
                                    provenance={strat.callLeg.delta.provenance}
                                    source={strat.callLeg.delta.source}
                                    variant="badge"
                                  />
                                </span>
                              ) : null}
                            </div>
                            <DataValue
                              value={strat.callLeg.symbol}
                              format="raw"
                              provenance={strat.callLeg.provenance}
                              source={strat.callLeg.source}
                              variant="badge"
                            />
                          </div>

                          <div className="text-[11px] font-mono text-zinc-400 truncate" title={strat.callLeg.symbol}>
                            {strat.callLeg.symbol}
                          </div>

                          <div className="grid grid-cols-3 gap-1 pt-1 border-t border-zinc-800/80 text-[11px] font-mono">
                            <div>
                              <span className="text-zinc-400 block text-[9px]">BID / ASK</span>
                              <span className="text-zinc-300">
                                <DataValue value={strat.callLeg.bid} format="currency" provenance={strat.callLeg.provenance} source={strat.callLeg.source} variant="inline" /> / <DataValue value={strat.callLeg.ask} format="currency" provenance={strat.callLeg.provenance} source={strat.callLeg.source} variant="inline" />
                              </span>
                            </div>
                            <div>
                              <span className="text-zinc-400 block text-[9px]">MID</span>
                              <span className="text-emerald-400 font-bold">
                                <DataValue value={strat.callLeg.mid} format="currency" provenance={strat.callLeg.provenance} source={strat.callLeg.source} variant="inline" />
                              </span>
                            </div>
                            <div>
                              <span className="text-zinc-400 block text-[9px]">SPREAD</span>
                              <span className="text-zinc-300">
                                <DataValue value={strat.callLeg.relativeSpread * 100} format="percent" provenance={strat.callLeg.provenance} source={strat.callLeg.source} variant="inline" />
                              </span>
                            </div>
                          </div>
                          <div className="text-[10px] text-zinc-400 flex items-center justify-between pt-1">
                            <span>Open Interest (OI):</span>
                            <span className="font-mono text-zinc-200 font-semibold">
                              <DataValue value={strat.callLeg.openInterest} format="number" provenance={strat.callLeg.provenance} source={strat.callLeg.source} variant="inline" />
                            </span>
                          </div>
                        </div>

                        {/* PUT OTM */}
                        <div className="bg-zinc-950/90 rounded-lg p-3 border border-zinc-800 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="bg-blue-500/20 text-blue-400 border border-blue-500/30 text-[10px] font-bold px-1.5 py-0.5 rounded font-mono">
                                PUT (BUY)
                              </span>
                              <span className="text-xs font-bold text-zinc-100">
                                <DataValue
                                  value={strat.putLeg.strike}
                                  format="currency"
                                  provenance={strat.putLeg.provenance}
                                  source={strat.putLeg.source}
                                  variant="inline"
                                />
                              </span>
                              {strat.putLeg.delta ? (
                                <span className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded text-[10px] font-mono">
                                  <span className="text-zinc-400">Δ:</span>
                                  <span className="text-blue-400 font-bold">
                                    <DataValue
                                      value={strat.putLeg.delta.value}
                                      format="number"
                                      provenance={strat.putLeg.delta.provenance}
                                      source={strat.putLeg.delta.source}
                                      variant="inline"
                                    />
                                  </span>
                                  <DataValue
                                    value={strat.putLeg.delta.value}
                                    format="raw"
                                    provenance={strat.putLeg.delta.provenance}
                                    source={strat.putLeg.delta.source}
                                    variant="badge"
                                  />
                                </span>
                              ) : null}
                            </div>
                            <DataValue
                              value={strat.putLeg.symbol}
                              format="raw"
                              provenance={strat.putLeg.provenance}
                              source={strat.putLeg.source}
                              variant="badge"
                            />
                          </div>

                          <div className="text-[11px] font-mono text-zinc-400 truncate" title={strat.putLeg.symbol}>
                            {strat.putLeg.symbol}
                          </div>

                          <div className="grid grid-cols-3 gap-1 pt-1 border-t border-zinc-800/80 text-[11px] font-mono">
                            <div>
                              <span className="text-zinc-400 block text-[9px]">BID / ASK</span>
                              <span className="text-zinc-300">
                                <DataValue value={strat.putLeg.bid} format="currency" provenance={strat.putLeg.provenance} source={strat.putLeg.source} variant="inline" /> / <DataValue value={strat.putLeg.ask} format="currency" provenance={strat.putLeg.provenance} source={strat.putLeg.source} variant="inline" />
                              </span>
                            </div>
                            <div>
                              <span className="text-zinc-400 block text-[9px]">MID</span>
                              <span className="text-blue-400 font-bold">
                                <DataValue value={strat.putLeg.mid} format="currency" provenance={strat.putLeg.provenance} source={strat.putLeg.source} variant="inline" />
                              </span>
                            </div>
                            <div>
                              <span className="text-zinc-400 block text-[9px]">SPREAD</span>
                              <span className="text-zinc-300">
                                <DataValue value={strat.putLeg.relativeSpread * 100} format="percent" provenance={strat.putLeg.provenance} source={strat.putLeg.source} variant="inline" />
                              </span>
                            </div>
                          </div>
                          <div className="text-[10px] text-zinc-400 flex items-center justify-between pt-1">
                            <span>Open Interest (OI):</span>
                            <span className="font-mono text-zinc-200 font-semibold">
                              <DataValue value={strat.putLeg.openInterest} format="number" provenance={strat.putLeg.provenance} source={strat.putLeg.source} variant="inline" />
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* TABELA DE CONFERÊNCIA 1:1 CONTRA A TASTYTRADE */}
          <section className="space-y-4 pt-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-white">
                  Conferência 1:1 contra Terminal Tastytrade
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Exibição dos nomes exatos dos campos da API Tastytrade (<code className="text-emerald-400">tos-implied-volatility-index-rank</code>, <code className="text-emerald-400">implied-volatility-percentile</code>) para conferência direta.
                </p>
              </div>

              {/* FILTROS ESTRUTURADOS COM TIPOS DO DOMÍNIO */}
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  placeholder="Filtrar ticker..."
                  value={searchSymbol}
                  onChange={(e) => setSearchSymbol(e.target.value)}
                  className="bg-zinc-900 border border-zinc-700 text-xs text-zinc-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-emerald-500 w-32 uppercase font-mono"
                />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as 'ALL' | ScreenerCandidateStatus)}
                  className="bg-zinc-900 border border-zinc-700 text-xs text-zinc-200 rounded px-2 py-1.5 focus:outline-none"
                >
                  <option value="ALL">Status: Todos</option>
                  <option value="APPROVED_FOR_EXECUTION">Apenas Aprovados (APPROVED_FOR_EXECUTION)</option>
                  <option value="REJECTED">Apenas Rejeitados (REJECTED)</option>
                </select>
                <select
                  value={stageFilter}
                  onChange={(e) => setStageFilter(e.target.value as 'ALL' | ScreenerRejectionStage)}
                  className="bg-zinc-900 border border-zinc-700 text-xs text-zinc-200 rounded px-2 py-1.5 focus:outline-none"
                >
                  <option value="ALL">Estágio: Todos</option>
                  <option value="LAYER_0">Camada 0 (HV Histórico)</option>
                  <option value="LAYER_1">Camada 1 (BBW Squeeze)</option>
                  <option value="LAYER_2">Camada 2 (Confirmação IV)</option>
                  <option value="LAYER_3_LIQUIDITY">Camada 3 (Liquidez &amp; Estrutura)</option>
                </select>
              </div>
            </div>

            {/* TABELA RESPONSIVA COM SCROLL HORIZONTAL */}
            <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900/50 shadow">
              <div className="overflow-x-auto max-h-[600px]">
                <table className="w-full text-left text-xs text-zinc-300 font-sans border-collapse">
                  <thead className="bg-zinc-900/90 text-zinc-400 font-mono text-[11px] uppercase tracking-wider sticky top-0 z-10 border-b border-zinc-800">
                    <tr>
                      <th className="p-3">Símbolo / Setor</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">hv12m (GK)</th>
                      <th className="p-3 text-right">hv12mTrimmed</th>
                      <th className="p-3 text-right">hvDropRatio</th>
                      <th className="p-3 text-right">hv12mPercentile</th>
                      <th className="p-3 text-right">bbwCurrent</th>
                      <th className="p-3 text-right">bbwHistoryPct</th>
                      <th className="p-3 text-right">tos-iv-rank (IVR)</th>
                      <th className="p-3 text-right">iv-percentile (IVP)</th>
                      <th className="p-3">Vencimento (DTE)</th>
                      <th className="p-3">Motivo / Rejeição</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60 font-mono">
                    {filteredEvaluations.length === 0 ? (
                      <tr>
                        <td colSpan={12} className="p-6 text-center text-zinc-400 font-sans">
                          Nenhum ativo encontrado para os filtros selecionados.
                        </td>
                      </tr>
                    ) : (
                      filteredEvaluations.map((row) => {
                        const isApproved = row.status === 'APPROVED_FOR_EXECUTION';
                        const l0 = row.layer0;
                        const l1 = row.layer1;
                        const l2 = row.layer2;

                        return (
                          <tr
                            key={row.symbol}
                            className={`hover:bg-zinc-800/40 transition ${
                              isApproved ? 'bg-emerald-950/30 font-semibold' : ''
                            }`}
                          >
                            {/* Símbolo / Setor */}
                            <td className="p-3 font-bold text-white">
                              <div className="text-sm">{row.symbol}</div>
                              <div className="text-[10px] text-zinc-400 font-sans font-normal truncate max-w-[140px]">
                                {row.sector}
                              </div>
                            </td>

                            {/* Status */}
                            <td className="p-3">
                              {isApproved ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/25 text-emerald-300 border border-emerald-500/50 shadow-sm">
                                  APPROVED_FOR_EXECUTION
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30">
                                  {row.rejectionStage || 'REJECTED'}
                                </span>
                              )}
                            </td>

                            {/* hv12m */}
                            <td className="p-3 text-right">
                              <DataValue
                                value={l0?.hv12m?.value}
                                format="percent"
                                provenance={l0?.hv12m?.provenance}
                                source={l0?.hv12m?.source}
                                variant="badge"
                              />
                            </td>

                            {/* hv12mTrimmed */}
                            <td className="p-3 text-right">
                              <DataValue
                                value={l0?.hv12mTrimmed?.value}
                                format="percent"
                                provenance={l0?.hv12mTrimmed?.provenance}
                                source={l0?.hv12mTrimmed?.source}
                                variant="badge"
                              />
                            </td>

                            {/* hvDropRatio com proveniência explícita */}
                            <td className="p-3 text-right">
                              {l0?.hvDropRatio ? (
                                <DataValue
                                  value={l0.hvDropRatio.value * 100}
                                  format="percent"
                                  provenance={l0.hvDropRatio.provenance}
                                  source={l0.hvDropRatio.source}
                                  variant="badge"
                                />
                              ) : (
                                <span className="text-zinc-400">-</span>
                              )}
                            </td>

                            {/* hv12mPercentile */}
                            <td className="p-3 text-right">
                              <DataValue
                                value={l0?.hv12mPercentile?.value}
                                format="percent"
                                provenance={l0?.hv12mPercentile?.provenance}
                                source={l0?.hv12mPercentile?.source}
                                variant="badge"
                              />
                            </td>

                            {/* bbwCurrent */}
                            <td className="p-3 text-right">
                              {l1 ? (
                                <DataValue
                                  value={l1.bbwCurrent?.value}
                                  format="number"
                                  provenance={l1.bbwCurrent?.provenance}
                                  source={l1.bbwCurrent?.source}
                                  variant="badge"
                                />
                              ) : (
                                <span className="text-zinc-400">-</span>
                              )}
                            </td>

                            {/* bbwHistoryPercentile */}
                            <td className="p-3 text-right">
                              {l1 ? (
                                <DataValue
                                  value={l1.bbwHistoryPercentile?.value}
                                  format="percent"
                                  provenance={l1.bbwHistoryPercentile?.provenance}
                                  source={l1.bbwHistoryPercentile?.source}
                                  variant="badge"
                                />
                              ) : (
                                <span className="text-zinc-400">-</span>
                              )}
                            </td>

                            {/* tos-implied-volatility-index-rank */}
                            <td className="p-3 text-right">
                              {l2 ? (
                                <DataValue
                                  value={l2.ivRank?.value}
                                  format="number"
                                  provenance={l2.ivRank?.provenance}
                                  source="market-metrics"
                                  variant="badge"
                                />
                              ) : (
                                <span className="text-zinc-400">-</span>
                              )}
                            </td>

                            {/* implied-volatility-percentile */}
                            <td className="p-3 text-right">
                              {l2 ? (
                                <DataValue
                                  value={l2.ivPercentile?.value}
                                  format="percent"
                                  provenance={l2.ivPercentile?.provenance}
                                  source="market-metrics"
                                  variant="badge"
                                />
                              ) : (
                                <span className="text-zinc-400">-</span>
                              )}
                            </td>

                            {/* Vencimento Selecionado */}
                            <td className="p-3 text-xs">
                              {l2?.selectedExpiration ? (
                                <div>
                                  <div className="font-semibold text-zinc-200">
                                    {l2.selectedExpiration.expirationDate}
                                  </div>
                                  <div className="text-[10px] text-zinc-400 font-mono">
                                    {/* eslint-disable-next-line local-rules/no-raw-numbers-in-jsx -- dte de vencimento */}
                                    {l2.selectedExpiration.dte}d ({l2.selectedExpiration.selectionRule})
                                  </div>
                                </div>
                              ) : (
                                <span className="text-zinc-400">-</span>
                              )}
                            </td>

                            {/* Motivo de Rejeição */}
                            <td className="p-3 text-[11px] font-sans max-w-xs truncate text-zinc-400" title={row.rejectionReason || 'Aprovado'}>
                              {isApproved ? (
                                <span className="text-emerald-400 font-semibold">Aprovado para execução (Strangle)</span>
                              ) : (
                                <>
                                  <span className="text-rose-400 font-mono text-[10px] mr-1">[{row.rejectionCode}]</span>
                                  <span>{row.rejectionReason}</span>
                                </>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </>
      )}

    </div>
  );
}
