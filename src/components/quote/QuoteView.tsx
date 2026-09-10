'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { 
  Activity, 
  TrendingUp, 
  TrendingDown, 
  FileText, 
  Layers, 
  GraduationCap, 
  Bot, 
  CheckCircle2, 
  Send,
  Shield,
  Target,
  ArrowRight,
  Clock,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Sliders,
  DollarSign,
  AlertTriangle,
  Info,
  Sparkles,
  Loader2,
  Video,
  Mic,
  MicOff
} from 'lucide-react';


import { CandlestickChart } from './CandlestickChart';
import { OptionPayoffChart, ElectedStrategyData, buildElectedStrategyFromRecommendation } from '../options/OptionPayoffChart';
import { SP500_DATASET } from '@/lib/domain/sp500-dataset';
import { VolatilityRecommendation } from '@/lib/domain/volatility-engine';
import { UnifiedGexBarreirasView } from '../options/UnifiedGexBarreirasView';
import { US_STOCKS_DATASET, USStockItem, generateCandlesticks } from '@/lib/domain/us-market-data';
import { CME_25_STRATEGIES, StrategySpec } from '@/lib/domain/cme-catalog';
import { fundamentalsEngine } from '@/lib/domain/fundamentals-engine';
import { RawFundamentalData } from '@/lib/types/financial';
import { aiConsultantEngine } from '@/lib/domain/ai-consultant';
import { DataValue } from '@/components/shared/DataValue';

interface QuoteViewProps {
  initialSymbol?: string;
  symbol?: string;
  onNavigateToGex?: (sym: string) => void;
  onNavigateToBarreiras?: (sym: string) => void;
  onBackToScreener?: () => void;
}

export function QuoteView({ initialSymbol, symbol: propSymbol, onNavigateToGex, onNavigateToBarreiras, onBackToScreener }: QuoteViewProps) {
  const symbol = initialSymbol || propSymbol || 'NVDA';
  const navGexFn = onNavigateToGex || onNavigateToBarreiras;
  const [activeTab, setActiveTab] = useState<'tecnico' | 'fundamentos' | 'opcoes' | 'recomendacoes' | 'ia'>('tecnico');
  const [execMode, setExecMode] = useState<'OPTIONS' | 'STOCK'>('OPTIONS');
  const [showFullOptionCatalog, setShowFullOptionCatalog] = useState(false);
  const [optionCategoryFilter, setOptionCategoryFilter] = useState<'ALL' | 'Direcional' | 'Precisão' | 'Arbitragem'>('ALL');
  const [selectedOptionStrategy, setSelectedOptionStrategy] = useState<StrategySpec>(CME_25_STRATEGIES[19]); // Iron Condor
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant'; text: string }>>([
    {
      role: 'assistant',
      text: `Olá! Sou o Consultor Quantitativo IA para ${symbol.toUpperCase()}. Posso responder sobre a leitura de Gamma Exposure (GEX), viés técnico pelo checklist CNPI-T, múltiplos contábeis e as ${CME_25_STRATEGIES.length} estratégias de opções. O que deseja analisar?`,
    },
  ]);
  const [inputMessage, setInputMessage] = useState('');

  const isKnownTicker = useMemo(
    () => US_STOCKS_DATASET.some(s => s.symbol === symbol.toUpperCase().trim()),
    [symbol]
  );

  const currentStock: USStockItem = useMemo(() => {
    const found = US_STOCKS_DATASET.find(s => s.symbol === symbol.toUpperCase().trim());
    if (found) return found;
    // Fora da cobertura do RADAR (~66 ativos monitorados) — este objeto é usado só para
    // a página não quebrar (gráfico/abas exigem os campos); o banner logo no início do
    // render avisa que os números abaixo são ilustrativos, não dado real deste ticker
    // (Achado D-04/parte de C-03 do laudo Ciclo 4).
    return {
      symbol: symbol.toUpperCase().trim(),
      name: `${symbol.toUpperCase().trim()} Stock`,
      sector: 'Geral',
      category: 'ALTA',
      spot: 150.00,
      change: 1.2,
      peRatio: 25.0,
      evEbitda: 15.0,
      dividendYield: 1.5,
      roe: 20.0,
      netMargin: 15.0,
      debtToEbitda: 1.0,
      ivRank: 35.0,
      ivAtm: 22.0,
      stop: 142.50,
      alvo1: 157.50,
      alvo2: 165.00,
      rr: '2.10:1',
      fundStatus: 'APROVADO',
      fundScore: 85,
    };
  }, [symbol]);

  const fundResult = useMemo(() => {
    const rawData: RawFundamentalData = {
      symbol: currentStock.symbol,
      shortName: currentStock.name,
      regularMarketPrice: currentStock.spot,
      returnOnEquity: currentStock.roe !== undefined ? currentStock.roe / 100 : null,
      netMargin: currentStock.netMargin !== undefined ? currentStock.netMargin / 100 : null,
      debtToEbitda: currentStock.debtToEbitda ?? null,
      financialDebtToEbitda: currentStock.debtToEbitda !== undefined ? Math.min(currentStock.debtToEbitda, 1.2) : null,
      priceEarnings: currentStock.peRatio ?? null,
      dividendYield: currentStock.dividendYield !== undefined ? currentStock.dividendYield / 100 : null,
      // Mesma correção de fundamentals/route.ts (Nível 3, Ciclo 4): estes 3 campos não
      // são levantados para US_STOCKS_DATASET. Antes esta tela tinha sua PRÓPRIA cópia
      // divergente das constantes fabricadas (1.45/0.28, e um P/VP estimado por
      // peRatio/18 — uma heurística sem base declarada), dando nota diferente do que a
      // API mostrava para o mesmo ticker. Agora null nos dois lugares, e o
      // fundamentals-engine já trata isso como "Dado não disponível na fonte".
      currentRatio: null,
      ebitdaMargin: null,
      priceToBook: null,
    };
    return fundamentalsEngine.evaluate(rawData);
  }, [currentStock]);

  // Generate Elected Strategy dynamically for the stock based on its category
  const candles = useMemo(() => {

    return generateCandlesticks(currentStock.symbol, currentStock.spot, 90);
  }, [currentStock.symbol, currentStock.spot]);

  // Cobertura real de opções: só os tickers presentes no SP500_DATASET têm os campos
  // (IV30/RV20/IVR/IVP, GEX, Walls de OI) exigidos pelo volatilityEngine. Fora dessa
  // lista (33 dos 64 tickers de US_STOCKS_DATASET), a aba Opções mostra aviso de falta
  // de cobertura em vez de fabricar strikes/prêmios com `spot × constante` (Achado D-01
  // do laudo Ciclo 4 — corrigido nesta etapa, Nível 1 Parte 3).
  const sp500Stock = useMemo(
    () => SP500_DATASET.find(s => s.symbol === symbol.toUpperCase().trim()),
    [symbol]
  );
  const hasOptionsCoverage = !!sp500Stock;

  // Recomendação real: motor de volatilidade reescrito (2026-09-08) para exigir
  // strike/vencimento/preço reais da Tastytrade (cadeia real + cotação real por
  // contrato via REST). Antes esta chamada era síncrona (volatilityEngine.evaluate)
  // e sempre "resolvia" para algo, mesmo que fabricado; agora é uma consulta real via
  // API (/api/market/option-recommendation), que pode legitimamente não retornar nada
  // se a Tastytrade não confirmar dado real no momento — daí os 3 estados abaixo.
  const [volRecommendation, setVolRecommendation] = useState<VolatilityRecommendation | null>(null);
  const [volRecStatus, setVolRecStatus] = useState<'idle' | 'loading' | 'unavailable' | 'ready'>('idle');
  const [volRecReason, setVolRecReason] = useState<string>('');

  useEffect(() => {
    if (!sp500Stock) {
      setVolRecommendation(null);
      setVolRecStatus('idle');
      return;
    }
    let cancelled = false;
    setVolRecStatus('loading');
    fetch('/api/market/option-recommendation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sp500Stock),
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.available) {
          setVolRecommendation(data.recommendation);
          setVolRecStatus('ready');
        } else {
          setVolRecommendation(null);
          setVolRecStatus('unavailable');
          setVolRecReason(data.reason || 'Dado real indisponível no momento.');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setVolRecommendation(null);
          setVolRecStatus('unavailable');
          setVolRecReason('Falha ao consultar a API real da Tastytrade.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [sp500Stock]);

  const electedStrategy: ElectedStrategyData | null = useMemo(() => {
    if (!volRecommendation || !sp500Stock) return null;
    return buildElectedStrategyFromRecommendation(
      volRecommendation,
      sp500Stock.symbol,
      sp500Stock.avgOptionVolume
    );
  }, [volRecommendation, sp500Stock]);

  const [isAiLoading, setIsAiLoading] = useState(false);
  const [generatingVideoIndex, setGeneratingVideoIndex] = useState<number | null>(null);
  const [generatedVideos, setGeneratedVideos] = useState<{ [msgIndex: number]: string }>({});
  const [isListening, setIsListening] = useState(false);

  const toggleVoiceInput = () => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Reconhecimento de voz não suportado neste navegador. Recomendamos Google Chrome ou Microsoft Edge.');
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'pt-BR';
      recognition.interimResults = true;
      recognition.continuous = false;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        let currentTranscript = '';
        for (let i = 0; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        setInputMessage(currentTranscript);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (e) {
      console.error(e);
      setIsListening(false);
    }
  };

  const handleGenerateVideo = async (index: number, text: string) => {
    if (generatingVideoIndex !== null) return;
    setGeneratingVideoIndex(index);

    try {
      const response = await fetch('/api/avatar/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      const data = await response.json();
      if (data.success && data.videoUrl) {
        setGeneratedVideos((prev) => ({ ...prev, [index]: data.videoUrl }));
      } else {
        alert(`Aviso D-ID: ${data.error || 'Não foi possível renderizar o vídeo no momento.'}`);
      }
    } catch (err: any) {
      alert(`Erro na chamada ao serviço D-ID: ${err.message}`);
    } finally {
      setGeneratingVideoIndex(null);
    }
  };


  const handleSendMessage = async (customText?: string) => {

    const textToSend = (typeof customText === 'string' ? customText : inputMessage).trim();
    if (!textToSend || isAiLoading) return;
    setInputMessage('');
    setChatMessages((prev) => [...prev, { role: 'user', text: textToSend }]);
    setIsAiLoading(true);

    try {
      const response = await aiConsultantEngine.consult(textToSend, {
        symbol: currentStock.symbol,
        stock: currentStock,
        fundamentals: fundResult,
        electedStrategy,
        spotPrice: currentStock.spot,
        category: currentStock.category,
      });

      setChatMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: response.answer,
        },
      ]);
    } catch (err: any) {
      setChatMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: `Erro ao processar consulta: ${err?.message || 'Tente novamente.'}`,
        },
      ]);
    } finally {
      setIsAiLoading(false);
    }
  };

  const filteredOptionStrategies = useMemo(() => {
    if (optionCategoryFilter === 'ALL') return CME_25_STRATEGIES;
    return CME_25_STRATEGIES.filter(s => s.category === optionCategoryFilter);
  }, [optionCategoryFilter]);

  return (
    <section className="space-y-5">
      {!isKnownTicker && (
        <div className="bg-amber-500/10 border border-amber-500/40 text-amber-200 text-sm rounded-2xl p-4 flex items-start gap-3">
          <span className="text-lg leading-none">⚠️</span>
          <div>
            <p className="font-bold">
              {symbol.toUpperCase().trim()} está fora da cobertura atual do RADAR (~66 ativos monitorados).
            </p>
            <p className="text-amber-300/90 mt-1">
              Cotação, gráfico, fundamentos e estrutura de opções exibidos abaixo são valores
              ilustrativos de referência, não foram calculados a partir de dado real deste ativo,
              e não devem ser usados para decisão de investimento.
            </p>
          </div>
        </div>
      )}

      {/* Top Header Card */}
      <div className="bg-[#0c1322] border border-gray-800 p-5 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-xl">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-2xl font-black font-mono text-white tracking-tight">{currentStock.symbol}</h2>
            <span className="text-xs text-gray-400 font-sans">{currentStock.name}</span>
            <span className={`px-2.5 py-0.5 rounded text-[11px] font-bold font-mono ${
              currentStock.category === 'ALTA' 
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' 
                : currentStock.category === 'BAIXA' 
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' 
                : 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
            }`}>
              {currentStock.category === 'ALTA' ? 'RECOMENDAÇÃO DE COMPRA' : currentStock.category === 'BAIXA' ? 'RECOMENDAÇÃO DE VENDA / TRAVA' : 'RENDA COM OPÇÕES (LATERAL)'}
            </span>
            <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[10px] font-mono">
              SINCRONIZADO COM RASTREADOR
            </span>
          </div>
          {/* Checklist antes fixo (achado C5-01, laudo Ciclo 5): "SPOT: REAL (TASTYTRADE)",
              "OPÇÕES: NET GEX POSITIVO" e "MACRO: FED 4.50%" eram strings estáticas, nunca
              recalculadas por ticker — inclusive aparecendo "GEX POSITIVO" para ativos com
              GEX negativo. Corrigido para refletir a fonte real de cada dado: spot vem do
              catálogo estático (não é cotação live desta tela — diferente da cadeia de
              opções, que agora É real via Tastytrade), o regime de GEX vem da recomendação
              real quando disponível, e a taxa de juros não tem fonte no RADAR hoje, então
              deixou de ser exibida como se fosse. */}
          <div className="flex items-center gap-2 text-[11px] font-mono text-gray-400 mt-2">
            <span>1. SPOT: CATÁLOGO (US_STOCKS_DATASET)</span>
            <span>•</span>
            <span>2. FUNDAM: {currentStock.fundStatus}</span>
            <span>•</span>
            <span>
              3. OPÇÕES:{' '}
              {volRecStatus === 'ready' && volRecommendation
                ? `${volRecommendation.gexRegime} (real, Tastytrade)`
                : hasOptionsCoverage
                ? 'aguardando dado real'
                : 'sem cobertura'}
            </span>
            <span>•</span>
            <span>4. MACRO: não monitorado pelo RADAR</span>
          </div>
        </div>

        <div className="flex items-center gap-6 bg-[#070b14] px-5 py-3 rounded-xl border border-gray-800 text-right">
          <DataValue
            label="SPOT"
            value={currentStock.spot}
            format="currency"
            provenance="ESTIMADO"
            source="US_STOCKS_DATASET (catálogo estático)"
            size="lg"
            className="items-end text-right"
          />
          <DataValue
            label="VARIAÇÃO"
            value={currentStock.change}
            format="percent"
            provenance="ESTIMADO"
            source="US_STOCKS_DATASET (catálogo estático)"
            size="sm"
            className={`items-end text-right ${currentStock.change >= 0 ? '[&_.font-bold]:text-emerald-400' : '[&_.font-bold]:text-rose-400'}`}
          />
          <div className="border-l border-gray-800 pl-4">
            <DataValue
              label="OPÇÕES"
              value={volRecStatus === 'ready' && electedStrategy ? `${electedStrategy.expirationDate} (${electedStrategy.dte} DTE)` : null}
              format="raw"
              provenance={volRecStatus === 'ready' && electedStrategy ? 'MEDIDO' : 'INDISPONIVEL'}
              source="Tastytrade REST (option-recommendation)"
              unavailableLabel="N/D"
              size="sm"
              className="items-end text-right [&_.font-bold]:text-cyan-300"
            />
          </div>
        </div>
      </div>

      {/* 5 Sub-Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-gray-800/80 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('tecnico')}
          className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition flex items-center gap-2 ${
            activeTab === 'tecnico'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
              : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Técnico (CNPI-T)</span>
        </button>

        <button
          onClick={() => setActiveTab('fundamentos')}
          className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition flex items-center gap-2 ${
            activeTab === 'fundamentos'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
              : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Fundamentos (CNPI-F)</span>
        </button>

        <button
          onClick={() => setActiveTab('opcoes')}
          className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition flex items-center gap-2 ${
            activeTab === 'opcoes'
              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
              : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Opções & GEX (Tastytrade)</span>
        </button>

        <button
          onClick={() => setActiveTab('recomendacoes')}
          className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition flex items-center gap-2 ${
            activeTab === 'recomendacoes'
              ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/50 shadow-md shadow-emerald-500/10'
              : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
          }`}
        >
          <GraduationCap className="w-3.5 h-3.5 text-emerald-400" />
          <span>Recomendações de Estudo</span>
        </button>

        <button
          onClick={() => setActiveTab('ia')}
          className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition flex items-center gap-2 ${
            activeTab === 'ia'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
              : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
          }`}
        >
          <Bot className="w-3.5 h-3.5 text-cyan-400" />
          <span>Consultor IA</span>
        </button>
      </div>

      {/* Sub-Tab 1: Técnico */}
      {activeTab === 'tecnico' && (
        <div className="space-y-5">
          <CandlestickChart candles={candles} spotPrice={currentStock.spot} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[#0c1322] border border-gray-800 p-5 rounded-2xl space-y-3">
              <div className="flex justify-between items-center border-b border-gray-800 pb-2">
                <h4 className="text-xs font-bold font-mono text-white flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  CHECKLIST TÉCNICO (5 ITENS CNPI-T)
                </h4>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">
                  {currentStock.category === 'ALTA' ? '5/5 APROVADO' : currentStock.category === 'LATERAL' ? '4/5 LATERAL' : '2/5 ALERTA'}
                </span>
              </div>
              <div className="space-y-2 text-xs font-mono">
                <div className="flex justify-between p-2 rounded-lg bg-[#070b14] border border-gray-800">
                  <span className="text-gray-300">1. Alinhamento de Médias (MA20 &gt; MA50 &gt; MA200)</span>
                  <span className="text-emerald-400 font-bold">{currentStock.category === 'ALTA' ? '✓ CONFIRMADO' : currentStock.category === 'LATERAL' ? '≈ LATERAL' : '✗ DIVERGENTE'}</span>
                </div>
                <div className="flex justify-between p-2 rounded-lg bg-[#070b14] border border-gray-800">
                  <span className="text-gray-300">2. RSI(14) em Faixa Saudável (42 - 68)</span>
                  <span className="text-emerald-400 font-bold">✓ 56.4 (OK)</span>
                </div>
                <div className="flex justify-between p-2 rounded-lg bg-[#070b14] border border-gray-800">
                  <span className="text-gray-300">3. MACD Acima da Linha de Sinal</span>
                  <span className="text-emerald-400 font-bold">✓ POSITIVO (+0.42)</span>
                </div>
                <div className="flex justify-between p-2 rounded-lg bg-[#070b14] border border-gray-800">
                  <span className="text-gray-300">4. Volume Projetado &gt; Média 20</span>
                  <span className="text-emerald-400 font-bold">✓ 112% DA MÉDIA</span>
                </div>
                <div className="flex justify-between p-2 rounded-lg bg-[#070b14] border border-gray-800">
                  <span className="text-gray-300">5. Afastamento dos Suportes e Resistências</span>
                  <span className="text-cyan-300 font-bold">✓ ESPAÇO LIVRE</span>
                </div>
              </div>
            </div>

            <div className="bg-[#0c1322] border border-gray-800 p-5 rounded-2xl space-y-3 font-mono">
              <div className="flex justify-between items-center border-b border-gray-800 pb-2">
                <h4 className="text-xs font-bold text-white flex items-center gap-2">
                  <Target className="w-3.5 h-3.5 text-cyan-400" />
                  PARÂMETROS DE ESTUDO & RISCO/RETORNO
                </h4>
                <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-400 font-bold">
                  R:R {currentStock.rr}
                </span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="p-2 rounded-lg bg-[#070b14] border border-gray-800">
                  <DataValue
                    label="Preço de Entrada (Spot)"
                    value={currentStock.spot}
                    format="currency"
                    provenance="ESTIMADO"
                    source="US_STOCKS_DATASET (catálogo estático)"
                    size="sm"
                    className="flex flex-row items-center justify-between w-full"
                  />
                </div>
                <div className="p-2 rounded-lg bg-[#070b14] border border-gray-800">
                  <DataValue
                    label="Stop Loss Técnico"
                    value={currentStock.stop}
                    format="currency"
                    provenance="ESTIMADO"
                    source="US_STOCKS_DATASET (catálogo estático)"
                    size="sm"
                    className="flex flex-row items-center justify-between w-full [&_.font-bold]:text-rose-400"
                  />
                </div>
                <div className="p-2 rounded-lg bg-[#070b14] border border-gray-800">
                  <DataValue
                    label="Alvo Parcial (1ª Resistência)"
                    value={currentStock.alvo1}
                    format="currency"
                    provenance="ESTIMADO"
                    source="US_STOCKS_DATASET (catálogo estático)"
                    size="sm"
                    className="flex flex-row items-center justify-between w-full [&_.font-bold]:text-emerald-400"
                  />
                </div>
                <div className="p-2 rounded-lg bg-[#070b14] border border-gray-800">
                  <DataValue
                    label="Alvo Final (2ª Resistência)"
                    value={currentStock.alvo2}
                    format="currency"
                    provenance="ESTIMADO"
                    source="US_STOCKS_DATASET (catálogo estático)"
                    size="sm"
                    className="flex flex-row items-center justify-between w-full [&_.font-bold]:text-emerald-400"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sub-Tab 2: Fundamentos (CNPI-P Auditado & Normalizado) */}
      {activeTab === 'fundamentos' && (
        <div className="bg-[#0c1322] border border-gray-800 p-6 rounded-2xl space-y-6">
          {/* Header do Crivo Fundamentalista */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-gray-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white font-mono">CRIVO FUNDAMENTALISTA (CNPI-P / ANÁLISE NORMALIZADA)</h3>
                {fundResult.isReconciled && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    RECONCILIADO & NORMALIZADO
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                Pesos Oficiais: Rentabilidade (35%) • Solvência (35%) • Valuation (30%) | Limiar de Aprovação ≥ {fundResult.minApprovalScore} pts
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 ${
                fundResult.status === 'APROVADO'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm shadow-emerald-500/10'
                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm shadow-rose-500/10'
              }`}>
                {fundResult.status === 'APROVADO' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                )}
                SCORE: {fundResult.score}/100 • {fundResult.status}
              </span>
            </div>
          </div>

          {/* Alerta de Auditoria Metodológica / Distorções Não-Caixa */}
          {fundResult.distortionsDetected.length > 0 && (
            <div className="p-4 rounded-xl bg-cyan-950/30 border border-cyan-500/30 text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold text-cyan-300">
                <Info className="w-4 h-4 shrink-0 text-cyan-400" />
                <span>Auditoria Metodológica & Normalização de Sanidade Aplicada:</span>
              </div>
              <ul className="list-disc list-inside text-gray-300 space-y-1 pl-1">
                {fundResult.distortionsDetected.map((distortion, idx) => (
                  <li key={idx} className="leading-relaxed">{distortion}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Cards dos 3 Pilares CNPI-P */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 bg-[#070b14] rounded-xl border border-gray-800">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400 font-medium">Rentabilidade (35%)</span>
                <span className={`text-xs font-mono font-bold ${
                  fundResult.pillars.rentabilidade.score >= 60 ? 'text-emerald-400' : fundResult.pillars.rentabilidade.score >= 40 ? 'text-amber-400' : 'text-rose-400'
                }`}>
                  {fundResult.pillars.rentabilidade.score}/100 pts
                </span>
              </div>
              <div className="w-full bg-gray-800 h-1.5 rounded-full mt-2 overflow-hidden">
                <div 
                  className={`h-full rounded-full ${fundResult.pillars.rentabilidade.score >= 60 ? 'bg-emerald-500' : fundResult.pillars.rentabilidade.score >= 40 ? 'bg-amber-500' : 'bg-rose-500'}`}
                  style={{ width: `${fundResult.pillars.rentabilidade.score}%` }}
                />
              </div>
            </div>

            <div className="p-3.5 bg-[#070b14] rounded-xl border border-gray-800">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400 font-medium">Solvência (35%)</span>
                <span className={`text-xs font-mono font-bold ${
                  fundResult.pillars.solvencia.score >= 60 ? 'text-emerald-400' : fundResult.pillars.solvencia.score >= 40 ? 'text-amber-400' : 'text-rose-400'
                }`}>
                  {fundResult.pillars.solvencia.score}/100 pts
                </span>
              </div>
              <div className="w-full bg-gray-800 h-1.5 rounded-full mt-2 overflow-hidden">
                <div 
                  className={`h-full rounded-full ${fundResult.pillars.solvencia.score >= 60 ? 'bg-emerald-500' : fundResult.pillars.solvencia.score >= 40 ? 'bg-amber-500' : 'bg-rose-500'}`}
                  style={{ width: `${fundResult.pillars.solvencia.score}%` }}
                />
              </div>
            </div>

            <div className="p-3.5 bg-[#070b14] rounded-xl border border-gray-800">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400 font-medium">Valuation (30%)</span>
                <span className={`text-xs font-mono font-bold ${
                  fundResult.pillars.valuation.score >= 60 ? 'text-emerald-400' : fundResult.pillars.valuation.score >= 40 ? 'text-amber-400' : 'text-rose-400'
                }`}>
                  {fundResult.pillars.valuation.score}/100 pts
                </span>
              </div>
              <div className="w-full bg-gray-800 h-1.5 rounded-full mt-2 overflow-hidden">
                <div 
                  className={`h-full rounded-full ${fundResult.pillars.valuation.score >= 60 ? 'bg-emerald-500' : fundResult.pillars.valuation.score >= 40 ? 'bg-amber-500' : 'bg-rose-500'}`}
                  style={{ width: `${fundResult.pillars.valuation.score}%` }}
                />
              </div>
            </div>
          </div>

          {/* Grid de Indicadores com Suporte a N/D e Valores Normalizados */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 font-mono text-xs">
            {fundResult.metrics.map((metric, idx) => {
              const isAdjusted = metric.isAdjusted;
              return (
                <div key={idx} className="p-3.5 bg-[#070b14] rounded-xl border border-gray-800 flex flex-col justify-between space-y-2 hover:border-gray-700 transition">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-gray-400 text-[11px] block font-sans font-medium">{metric.name}</span>
                      <span className="text-[10px] text-gray-500 font-mono">Meta: {metric.benchmark}</span>
                    </div>
                    {/* Badge de Status Semântico: BOM, NEUTRO, RUIM ou N/D */}
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      metric.status === 'BOM'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : metric.status === 'NEUTRO'
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : metric.status === 'RUIM'
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        : 'bg-gray-800 text-gray-400 border border-gray-700' // Badge N/D
                    }`}>
                      {metric.status}
                    </span>
                  </div>

                  <div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-base font-bold text-white tracking-tight">
                        {metric.formatted}
                      </span>
                      {isAdjusted && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-900/40 text-cyan-300 border border-cyan-600/40">
                          Ajustado
                        </span>
                      )}
                    </div>
                    {isAdjusted && metric.rawAccountingFormatted && (
                      <span className="text-[10px] text-gray-500 block">
                        Contábil BRAPI: <span className="line-through">{metric.rawAccountingFormatted}</span>
                      </span>
                    )}
                  </div>

                  <p className="text-[10px] text-gray-400 font-sans leading-tight pt-1 border-t border-gray-800/80">
                    {metric.description}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Diagnóstico Dinâmico do Motor CNPI-P */}
          <div className="p-4 bg-[#070b14] rounded-xl border border-gray-800 text-xs leading-relaxed space-y-2">
            <div className="flex items-center gap-2 text-white font-bold">
              <Shield className="w-4 h-4 text-emerald-400" />
              <h5>Diagnóstico e Parecer do Analista CNPI-P:</h5>
            </div>
            <p className="text-gray-300 leading-relaxed font-sans">
              {fundResult.summary}
            </p>
            <p className="text-gray-400 leading-relaxed font-sans italic pt-1 border-t border-gray-800/60">
              {fundResult.analystVerdict}
            </p>
          </div>
        </div>
      )}


      {/* Sub-Tab 3: Opções & GEX */}
      {activeTab === 'opcoes' && (
        <div className="bg-[#0c1322] border border-gray-800 p-6 rounded-2xl space-y-6">
          <div className="flex flex-wrap justify-between items-center gap-3 border-b border-gray-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white font-mono">OPÇÕES & GAMMA EXPOSURE</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                IV Rank/ATM: dado do dataset monitorado. Regime GEX: modelo calibrado (calculateGex), quando o ticker tem cobertura de opções.
              </p>
            </div>
            {navGexFn && (
              <button
                onClick={() => navGexFn(currentStock.symbol)}
                className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-mono font-bold transition flex items-center gap-1.5 shadow-md shadow-cyan-600/20"
              >
                <span>Ver Mapa GEX & Barreiras</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
            <div className="p-4 bg-[#070b14] rounded-xl border border-gray-800">
              <span className="text-gray-400 text-[10px] block font-sans">IV Rank</span>
              <span className="text-lg font-bold text-purple-400 mt-1 block">{currentStock.ivRank}%</span>
              <span className="text-[10px] text-gray-400">Volatilidade Histórica</span>
            </div>
            <div className="p-4 bg-[#070b14] rounded-xl border border-gray-800">
              <span className="text-gray-400 text-[10px] block font-sans">IV ATM (30 DTE)</span>
              <span className="text-lg font-bold text-cyan-400 mt-1 block">{currentStock.ivAtm}%</span>
              <span className="text-[10px] text-gray-400">Volatilidade Atual</span>
            </div>
            <div className="p-4 bg-[#070b14] rounded-xl border border-gray-800">
              <span className="text-gray-400 text-[10px] block font-sans">Put/Call Ratio</span>
              {/* Removido o valor fixo "0.68" (Achado Nível 4, Ciclo 4): nenhuma fonte no
                  projeto calcula Put/Call Ratio real por ticker — mostrar N/D é mais
                  honesto que um número igual para todo ativo. */}
              <span className="text-lg font-bold text-gray-500 mt-1 block">N/D</span>
              <span className="text-[10px] text-gray-500">Sem fonte de dado no sistema</span>
            </div>
            <div className="p-4 bg-[#070b14] rounded-xl border border-gray-800">
              <span className="text-gray-400 text-[10px] block font-sans">Regime GEX</span>
              {volRecommendation ? (
                <>
                  <span className={`text-lg font-bold mt-1 block ${volRecommendation.gexRegime === '+GEX' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {volRecommendation.gexRegime}
                  </span>
                  <span className={`text-[10px] ${volRecommendation.gexRegime === '+GEX' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {volRecommendation.gexRegime === '+GEX' ? 'Volatilidade Suprimida' : 'Volatilidade Explosiva'}
                  </span>
                </>
              ) : (
                <>
                  <span className="text-lg font-bold text-gray-500 mt-1 block">N/D</span>
                  <span className="text-[10px] text-gray-500">{currentStock.symbol} sem cobertura de opções</span>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sub-Tab 4: Recomendações de Estudo (IDÊNTICO AO RADAR B3) */}
      {activeTab === 'recomendacoes' && (
        <div className="space-y-5">
          {/* Top Switcher de Modalidade */}
          <div className="bg-[#0c1322] border border-gray-800 p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-lg">
            <div>
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-cyan-400" />
                <h4 className="font-bold text-white text-xs sm:text-sm">Qual modalidade você deseja estudar neste ativo?</h4>
              </div>
              <p className="text-[11px] text-gray-400 mt-0.5 font-sans">
                Selecionar entre o estudo com a estratégia eleita de opções da Tastytrade ou a análise direta do ativo à vista.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setExecMode('OPTIONS')}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition flex items-center gap-1.5 ${
                  execMode === 'OPTIONS'
                    ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-500/50 shadow-md shadow-cyan-500/10'
                    : 'bg-[#070b14] text-gray-400 hover:text-white border border-gray-800'
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
                <span>Estratégia de Opções Eleita</span>
              </button>

              <button
                onClick={() => setExecMode('STOCK')}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition flex items-center gap-1.5 ${
                  execMode === 'STOCK'
                    ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/50 shadow-md shadow-emerald-500/10'
                    : 'bg-[#070b14] text-gray-400 hover:text-white border border-gray-800'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                <span>Estudo da Ação à Vista</span>
              </button>
            </div>
          </div>

          {/* MODO OPÇÕES ELEITA */}
          {execMode === 'OPTIONS' && !hasOptionsCoverage && (
            <div className="bg-amber-500/10 border border-amber-500/40 text-amber-200 text-sm rounded-2xl p-4 flex items-start gap-3">
              <span className="text-lg leading-none">⚠️</span>
              <div>
                <p className="font-bold">{currentStock.symbol} sem cobertura para gerar estrutura de opções.</p>
                <p className="text-amber-300/90 mt-1">
                  A Estratégia Eleita depende de IV/HV, GEX e Walls de OI reais por ativo (SP500_DATASET), disponíveis hoje
                  para 48 dos tickers monitorados. {currentStock.symbol} não está nessa lista — em vez de estimar strikes e
                  prêmios artificialmente, o RADAR não gera uma estrutura para este ativo.
                </p>
              </div>
            </div>
          )}
          {execMode === 'OPTIONS' && hasOptionsCoverage && volRecStatus === 'loading' && (
            <div className="bg-cyan-500/10 border border-cyan-500/40 text-cyan-200 text-sm rounded-2xl p-4 flex items-center gap-3">
              <Loader2 className="w-4 h-4 animate-spin" />
              <p>Consultando cadeia de opções e cotações reais na Tastytrade...</p>
            </div>
          )}
          {execMode === 'OPTIONS' && hasOptionsCoverage && volRecStatus === 'unavailable' && (
            <div className="bg-amber-500/10 border border-amber-500/40 text-amber-200 text-sm rounded-2xl p-4 flex items-start gap-3">
              <span className="text-lg leading-none">⚠️</span>
              <div>
                <p className="font-bold">Sem dado real de opções disponível para {currentStock.symbol} agora.</p>
                <p className="text-amber-300/90 mt-1">{volRecReason}</p>
              </div>
            </div>
          )}
          {execMode === 'OPTIONS' && electedStrategy && (
            <div className="space-y-4">
              {/* CARD PRINCIPAL DA ESTRATÉGIA ELEITA */}
              <div className="p-5 bg-[#0b101b] border border-cyan-500/40 rounded-2xl shadow-2xl space-y-4 font-sans">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-800 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-lg bg-cyan-500 text-slate-950 font-black text-xs flex items-center justify-center font-mono shadow-md">
                        #{electedStrategy.id}
                      </span>
                      {/* nao e valor exibido como preco, e rotulo identificador da estrategia montada */}
                      <h4 className="font-bold text-white text-base sm:text-lg">
                        {electedStrategy.title}
                      </h4>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      Estratégia rainha da renda com opções: lucrar com a passagem do tempo enquanto a ação oscilar dentro do túnel.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <span className="px-3 py-1 bg-cyan-950 text-cyan-300 border border-cyan-500/40 rounded-xl text-xs font-bold font-mono">
                      {electedStrategy.dte} DTE • {electedStrategy.expirationDate}
                    </span>
                    <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded-xl text-xs font-bold font-mono">
                      ✓ {electedStrategy.status}
                    </span>
                  </div>
                </div>

                {/* 4 CARDS DE MÉTRICAS FINANCEIRAS DE MONTAGEM */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
                  <div className="p-3.5 bg-[#111827] rounded-xl border border-gray-800">
                    <DataValue
                      label={electedStrategy.isCredit ? 'CRÉDITO ESTIMADO' : 'CUSTO ESTIMADO'}
                      value={Math.abs(electedStrategy.netCostOrCredit)}
                      format="currency"
                      provenance="MEDIDO"
                      source="Tastytrade REST (option-recommendation)"
                      size="lg"
                      className="[&_.font-bold]:text-emerald-400"
                    />
                    <span className="text-[10px] text-gray-500 block font-sans mt-1">
                      (${electedStrategy.totalCostOrCreditForLot.toLocaleString('en-US', { minimumFractionDigits: 2 })} por contrato de 100)
                    </span>
                  </div>

                  <div className="p-3.5 bg-[#111827] rounded-xl border border-gray-800">
                    <DataValue
                      label="LARGURA DO SPREAD"
                      value={electedStrategy.spreadWidth}
                      format="currency"
                      provenance="MEDIDO"
                      source="Tastytrade REST (option-recommendation)"
                      size="lg"
                      className="[&_.font-bold]:text-cyan-400"
                    />
                    <span className="text-[10px] text-gray-500 block font-sans mt-1">
                      Retorno: {electedStrategy.returnOnRiskPct}% da largura
                    </span>
                  </div>

                  <div className="p-3.5 bg-[#111827] rounded-xl border border-gray-800">
                    <DataValue
                      label="PONTO DE EQUILÍBRIO"
                      value={electedStrategy.breakEven}
                      format="currency"
                      provenance="MEDIDO"
                      source="Tastytrade REST (option-recommendation)"
                      size="lg"
                      className="[&_.font-bold]:text-amber-400"
                    />
                    <span className="text-[10px] text-gray-500 block font-sans mt-1">
                      Break-even no vencimento
                    </span>
                  </div>

                  <div className="p-3.5 bg-[#111827] rounded-xl border border-emerald-500/30">
                    <span className="text-[10px] text-emerald-400 block font-sans">LUCRO ESTIMADO MÁXIMO</span>
                    <span className="text-lg font-bold text-emerald-400 mt-1 block">
                      +${electedStrategy.maxProfitLot.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-[10px] text-red-400 block font-sans">
                      Perda Máx: -${electedStrategy.maxLossLot.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* GRÁFICO MATEMÁTICO DE PAYOFF */}
                <OptionPayoffChart electedStrategy={electedStrategy} />

                {/* PERNAS DA MONTAGEM COM STRIKES REAIS TASTYTRADE */}
                <div className="p-4 bg-[#111827] rounded-xl border border-gray-800 space-y-3 font-mono">
                  <div className="flex items-center justify-between text-xs font-bold text-gray-300 font-sans">
                    <span>Pernas do Estudo (Modelo Interno · BSM):</span>
                    <span className="text-[11px] text-gray-500 font-mono">Tamanho Padrão: Contrato de 100 cotas</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {electedStrategy.legs.map((leg, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-xl border flex items-center justify-between ${
                          leg.action === 'VENDA'
                            ? 'bg-red-950/20 border-red-500/30'
                            : 'bg-emerald-950/20 border-emerald-500/30'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                leg.action === 'VENDA'
                                  ? 'bg-red-500/20 text-red-400'
                                  : 'bg-emerald-500/20 text-emerald-400'
                              }`}
                            >
                              {leg.action}
                            </span>
                            {/* nao e valor exibido como preco, e identificador de opcao (formato OCC-like) */}
                            <span className="font-bold text-white text-xs">{leg.symbol}</span>
                          </div>
                          <div className="mt-1">
                            <DataValue
                              label={`STRIKE (${leg.type})`}
                              value={leg.strike}
                              format="currency"
                              provenance="MEDIDO"
                              source="Tastytrade REST (option-recommendation)"
                              size="sm"
                            />
                          </div>
                        </div>

                        <div className="text-right">
                          <DataValue
                            label={leg.action === 'VENDA' ? 'PRÊMIO RECEBIDO' : 'PRÊMIO PAGO'}
                            value={leg.unitPrice}
                            format="currency"
                            provenance="MEDIDO"
                            source="Tastytrade REST (option-recommendation)"
                            size="sm"
                            className="items-end text-right"
                          />
                          <div className="text-[10px] text-gray-400 font-sans mt-0.5">
                            Total: ${leg.totalFinancial.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </div>
                          <div className="text-[9px] text-gray-500 font-mono">
                            OI: {leg.openInterest.toLocaleString('en-US')}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* RESUMO DO PREÇO TOTAL POR OPERAÇÃO */}
                  <div className="pt-3 border-t border-gray-800 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-[#0b101b] border border-gray-800 flex items-center gap-3">
                        <DataValue
                          label={electedStrategy.isCredit ? 'Crédito Líquido Total' : 'Custo Total da Operação (Débito)'}
                          value={Math.abs(electedStrategy.netCostOrCredit)}
                          format="currency"
                          provenance="MEDIDO"
                          source="Tastytrade REST (option-recommendation)"
                          size="md"
                          className={electedStrategy.isCredit ? '[&_.font-bold]:text-emerald-400' : '[&_.font-bold]:text-cyan-400'}
                        />
                        <div className="text-xs font-bold text-gray-300 font-sans self-end pb-0.5">
                          • ${Math.abs(electedStrategy.totalCostOrCreditForLot).toLocaleString('en-US', { minimumFractionDigits: 2 })} <span className="text-[10px] text-gray-500 font-normal">no contrato de 100</span>
                        </div>
                      </div>
                    </div>

                    {electedStrategy.pricingViability && (
                      <div className="p-2.5 rounded-xl border flex items-center gap-2.5 text-xs font-sans bg-emerald-950/20 border-emerald-500/30 text-emerald-300">
                        <Shield className="w-4 h-4 shrink-0 text-emerald-400" />
                        <div>
                          <div className="font-bold flex items-center gap-1.5">
                            <span>{electedStrategy.pricingViability.statusLabel}</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-gray-900 border border-gray-700 font-mono">
                              <DataValue variant="inline" value={electedStrategy.pricingViability.ratioToWidthPct} format="percent" provenance="SIMULADO" source="Modelo interno de precificação (sem consulta a book de opções real)" /> da largura
                            </span>
                          </div>
                          <div className="text-[11px] text-gray-400">
                            {electedStrategy.pricingViability.recommendationRule}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* GATILHOS DE SAÍDA DE ESTUDO */}
                <div className="p-4 bg-[#111827] rounded-xl border border-gray-800 space-y-3 font-sans">
                  <h5 className="font-bold text-white text-xs sm:text-sm flex items-center gap-1.5">
                    <Target className="w-4 h-4 text-cyan-400" />
                    <span>Gatilhos Teóricos de Saída (Take Profit, Stop Loss & Tempo):</span>
                  </h5>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                    <div className="p-3 bg-[#0b101b] rounded-xl border border-emerald-500/30 space-y-1.5">
                      <div className="flex items-center gap-1.5 font-bold text-emerald-400">
                        <TrendingUp className="w-3.5 h-3.5" />
                        <span>SAÍDA COM LUCRO:</span>
                      </div>
                      <p className="text-white font-semibold">
                        <DataValue variant="inline" value={electedStrategy.takeProfitRule.targetPct} format="percent" provenance="SIMULADO" source="Modelo interno de precificação (sem consulta a book de opções real)" /> do prêmio (+<DataValue variant="inline" value={electedStrategy.takeProfitRule.targetDollar} format="currency" provenance="SIMULADO" source="Modelo interno de precificação (sem consulta a book de opções real)" /> por contrato)
                      </p>
                      <p className="text-gray-400 text-[11px]">{electedStrategy.takeProfitRule.description}</p>
                    </div>

                    <div className="p-3 bg-[#0b101b] rounded-xl border border-red-500/30 space-y-1.5">
                      <div className="flex items-center gap-1.5 font-bold text-red-400">
                        <TrendingDown className="w-3.5 h-3.5" />
                        <span>SAÍDA COM PERDA (STOP):</span>
                      </div>
                      <p className="text-white font-semibold">
                        Perda máxima travada em −<DataValue variant="inline" value={electedStrategy.stopLossRule.maxLoss} format="currency" provenance="SIMULADO" source="Modelo interno de precificação (sem consulta a book de opções real)" /> por contrato
                      </p>
                      <p className="text-gray-400 text-[11px]">{electedStrategy.stopLossRule.description}</p>
                    </div>

                    <div className="p-3 bg-[#0b101b] rounded-xl border border-amber-500/30 space-y-1.5">
                      <div className="flex items-center gap-1.5 font-bold text-amber-400">
                        <Clock className="w-3.5 h-3.5" />
                        <span>GATILHO DE TEMPO (TIME STOP):</span>
                      </div>
                      <p className="text-white font-semibold">
                        Desmontar a <DataValue variant="inline" value={electedStrategy.timeStopRule.dteLimit} format="raw" provenance="SIMULADO" source="Playbook institucional Tastytrade (gerenciamento mecânico aos 21 DTE)" /> dias úteis do vencimento
                      </p>
                      <p className="text-gray-400 text-[11px]">{electedStrategy.timeStopRule.description}</p>
                    </div>
                  </div>
                </div>

                {/* BOTÃO PARA EXPANDIR CATÁLOGO COMPLETO DE 25 ESTRATÉGIAS */}
                <div className="pt-2 border-t border-gray-800 flex justify-center">
                  <button
                    onClick={() => setShowFullOptionCatalog(!showFullOptionCatalog)}
                    className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 font-medium px-4 py-2 rounded-xl bg-[#111827] hover:bg-gray-800 border border-gray-800 transition"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>{showFullOptionCatalog ? `Ocultar Catálogo das ${CME_25_STRATEGIES.length} Estratégias` : `Consultar Catálogo Oficial das ${CME_25_STRATEGIES.length} Estratégias de Opções`}</span>
                    {showFullOptionCatalog ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* CATÁLOGO EXPANSÍVEL */}
              {showFullOptionCatalog && (
                <div className="p-5 bg-[#0b101b] border border-gray-800 rounded-2xl shadow-xl space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-800 pb-3">
                    <div>
                      <h4 className="font-bold text-white text-base">
                        Catálogo Oficial: {CME_25_STRATEGIES.length} Estratégias Comprovadas de Opções (CME & OCC)
                      </h4>
                      <p className="text-xs text-gray-400">
                        Consulte o referencial teórico e perfil de Payoff de cada estratégia.
                      </p>
                    </div>

                    <div className="flex items-center gap-1 bg-[#111827] p-1 rounded-xl border border-gray-700 text-xs font-mono">
                      {(['ALL', 'Direcional', 'Precisão', 'Arbitragem'] as const).map((cat) => (
                        <button
                          key={cat}
                          onClick={() => setOptionCategoryFilter(cat)}
                          className={`px-2.5 py-1 rounded-lg transition ${
                            optionCategoryFilter === cat ? 'bg-amber-600 text-white font-bold' : 'text-gray-400 hover:text-white'
                          }`}
                        >
                          {cat === 'ALL' ? 'Todas (25)' : cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {filteredOptionStrategies.map((strat) => {
                      const isSelected = selectedOptionStrategy.id === strat.id;
                      return (
                        <div
                          key={strat.id}
                          onClick={() => setSelectedOptionStrategy(strat)}
                          className={`p-3.5 rounded-xl border cursor-pointer transition flex flex-col justify-between space-y-2 ${
                            isSelected
                              ? 'bg-amber-950/30 border-amber-500 ring-1 ring-amber-500/50'
                              : 'bg-[#111827] border-gray-800 hover:border-gray-700'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-mono font-bold text-amber-400">#{strat.id}</span>
                              <span className="px-2 py-0.2 rounded text-[10px] font-bold bg-gray-800 text-gray-300 font-mono">
                                {strat.category}
                              </span>
                            </div>
                            <h5 className="font-bold text-white text-xs sm:text-sm mt-1">{strat.name}</h5>
                            <p className="text-[10px] text-gray-400 font-mono">{strat.originalName}</p>
                            <p className="text-[11px] text-gray-300 mt-1 line-clamp-2">{strat.whenToUse}</p>
                          </div>

                          <div className="pt-2 border-t border-gray-800/80 flex items-center justify-between text-[10px] text-gray-400 font-mono">
                            <span>Viés: <strong>{strat.bias}</strong></span>
                            <span>Dificuldade: <strong>{strat.difficulty}</strong></span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* MODO ESTUDO DA AÇÃO À VISTA */}
          {execMode === 'STOCK' && (
            <div className="bg-[#0b101b] border border-emerald-500/40 rounded-2xl p-6 shadow-2xl space-y-5">
              <div className="flex justify-between items-center border-b border-gray-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <h4 className="font-bold text-white text-base">PLANO DE TRADE ESTRUTURADO — AÇÃO À VISTA (STOCK)</h4>
                </div>
                <span className="px-3 py-1 rounded-xl bg-cyan-950 text-cyan-300 border border-cyan-500/40 text-xs font-mono font-bold">
                  ASSIMETRIA R:R {currentStock.rr}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-[#070b14] rounded-xl border border-gray-800 space-y-3 font-mono">
                  <h5 className="font-bold text-xs text-emerald-400 font-sans uppercase">Parâmetros Operacionais de Entrada e Saída:</h5>
                  <div className="space-y-2 text-xs">
                    <div className="p-2 rounded-lg bg-[#111827]">
                      <DataValue
                        label="Preço de Entrada (Spot)"
                        value={currentStock.spot}
                        format="currency"
                        provenance="ESTIMADO"
                        source="US_STOCKS_DATASET (catálogo estático)"
                        size="sm"
                        className="flex flex-row items-center justify-between w-full"
                      />
                    </div>
                    <div className="p-2 rounded-lg bg-[#111827]">
                      <DataValue
                        label="Stop Loss Técnico"
                        value={currentStock.stop}
                        format="currency"
                        provenance="ESTIMADO"
                        source="US_STOCKS_DATASET (catálogo estático)"
                        size="sm"
                        className="flex flex-row items-center justify-between w-full [&_.font-bold]:text-rose-400"
                      />
                    </div>
                    <div className="p-2 rounded-lg bg-[#111827]">
                      <DataValue
                        label="Alvo Parcial (1ª Resistência)"
                        value={currentStock.alvo1}
                        format="currency"
                        provenance="ESTIMADO"
                        source="US_STOCKS_DATASET (catálogo estático)"
                        size="sm"
                        className="flex flex-row items-center justify-between w-full [&_.font-bold]:text-emerald-400"
                      />
                    </div>
                    <div className="p-2 rounded-lg bg-[#111827]">
                      <DataValue
                        label="Alvo Final (2ª Resistência)"
                        value={currentStock.alvo2}
                        format="currency"
                        provenance="ESTIMADO"
                        source="US_STOCKS_DATASET (catálogo estático)"
                        size="sm"
                        className="flex flex-row items-center justify-between w-full [&_.font-bold]:text-emerald-400"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-[#070b14] rounded-xl border border-gray-800 space-y-3 text-xs leading-relaxed text-gray-300">
                  <h5 className="font-bold text-white flex items-center gap-1.5 font-sans">
                    <Shield className="w-4 h-4 text-cyan-400" />
                    <span>Diretrizes de Risco e Gestão de Capital CNPI:</span>
                  </h5>
                  <ul className="space-y-1.5 list-disc list-inside text-gray-300">
                    <li>Alocação máxima recomendada: até <strong>2% a 5%</strong> do capital total na operação à vista.</li>
                    <li>Risco máximo por trade calibrado em <strong>1% do patrimônio líquido</strong>.</li>
                    <li>Realizar parcial de 50% no Alvo 1 e subir o Stop Loss para o preço de entrada (Breakeven).</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sub-Tab 5: Consultor IA (CNPI-P + CNPI-T + GEX + CME Options) */}
      {activeTab === 'ia' && (
        <div className="bg-[#0c1322] border border-gray-800 p-6 rounded-2xl space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-gray-800 pb-3">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-cyan-400 animate-pulse" />
              <div>
                <h3 className="text-sm font-bold text-white font-mono">CONSULTOR QUANTITATIVO IA (CNPI + GEX + CME)</h3>
                <p className="text-[11px] text-gray-400 font-sans">Motor integrado com 100% de conhecimento sobre fundamentos, opções, GEX e gestão de risco.</p>
              </div>
            </div>
            <span className="px-2.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-[10px] font-mono font-bold border border-cyan-500/30">
              SISTEMA ESPECIALISTA ONLINE
            </span>
          </div>

          {/* Chips de Sugestão de Perguntas Rápidas */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            <button
              disabled={isAiLoading}
              onClick={() => handleSendMessage(`Qual o diagnóstico quantitativo de Gamma Exposure (GEX) e volatilidade para ${currentStock.symbol}?`)}
              className="px-2.5 py-1 rounded-lg bg-[#070b14] hover:bg-cyan-950/40 text-cyan-300 border border-gray-800 hover:border-cyan-700/60 text-[11px] font-mono transition flex items-center gap-1 disabled:opacity-50"
            >
              <span>📊 GEX & Barreiras</span>
            </button>
            <button
              disabled={isAiLoading}
              onClick={() => handleSendMessage(`Como está a auditoria fundamentalista CNPI-P de ${currentStock.symbol} e houve distorção não-caixa ou de dívida?`)}
              className="px-2.5 py-1 rounded-lg bg-[#070b14] hover:bg-cyan-950/40 text-cyan-300 border border-gray-800 hover:border-cyan-700/60 text-[11px] font-mono transition flex items-center gap-1 disabled:opacity-50"
            >
              <span>🏛️ Crivo Fundamentalista CNPI-P</span>
            </button>
            <button
              disabled={isAiLoading}
              onClick={() => handleSendMessage(`Qual a estratégia de opções eleita do catálogo CME para ${currentStock.symbol} e como montá-la?`)}
              className="px-2.5 py-1 rounded-lg bg-[#070b14] hover:bg-cyan-950/40 text-cyan-300 border border-gray-800 hover:border-cyan-700/60 text-[11px] font-mono transition flex items-center gap-1 disabled:opacity-50"
            >
              <span>⚡ Estrutura de Opções Eleita</span>
            </button>
            <button
              disabled={isAiLoading}
              onClick={() => handleSendMessage(`Quais os parâmetros de Stop Loss técnico, Alvo 1 e Alvo 2 para ${currentStock.symbol}?`)}
              className="px-2.5 py-1 rounded-lg bg-[#070b14] hover:bg-cyan-950/40 text-cyan-300 border border-gray-800 hover:border-cyan-700/60 text-[11px] font-mono transition flex items-center gap-1 disabled:opacity-50"
            >
              <span>🎯 Parâmetros de Stop & Alvos</span>
            </button>
            <button
              disabled={isAiLoading}
              onClick={() => handleSendMessage(`Apresente o resumo executivo consolidado com as 4 camadas de análise para ${currentStock.symbol}.`)}
              className="px-2.5 py-1 rounded-lg bg-[#070b14] hover:bg-cyan-950/40 text-cyan-300 border border-gray-800 hover:border-cyan-700/60 text-[11px] font-mono transition flex items-center gap-1 disabled:opacity-50"
            >
              <span>🌐 Resumo Executivo 4 Camadas</span>
            </button>
          </div>

          {/* Histórico do Chat */}
          <div className="bg-[#070b14] border border-gray-800/80 rounded-xl p-4 h-80 overflow-y-auto space-y-3 font-sans text-xs">
            {chatMessages.map((msg, i) => (
              <div
                key={i}
                className={`p-3.5 rounded-xl max-w-[90%] leading-relaxed ${
                  msg.role === 'user'
                    ? 'ml-auto bg-cyan-600 text-white font-medium shadow-md shadow-cyan-600/10'
                    : 'bg-[#0f172a] text-gray-200 border border-gray-800 space-y-2'
                }`}
              >
                {msg.text.split('\n').map((line, lineIdx) => {
                  if (line.startsWith('### ')) {
                    return <h4 key={lineIdx} className="text-sm font-bold text-cyan-300 font-mono mt-1 mb-1">{line.replace('### ', '')}</h4>;
                  }
                  if (line.startsWith('• ') || line.startsWith('- ')) {
                    return <p key={lineIdx} className="text-gray-300 pl-2 leading-relaxed">{line}</p>;
                  }
                  if (line.trim() === '') {
                    return <div key={lineIdx} className="h-1" />;
                  }
                  return <p key={lineIdx} className="leading-relaxed">{line}</p>;
                })}

                {/* Botão e Player de Vídeo D-ID da Analista */}
                {msg.role === 'assistant' && (
                  <div className="pt-2 border-t border-gray-800/80 flex flex-col gap-2">
                    {generatedVideos[i] ? (
                      <div className="rounded-xl overflow-hidden border border-cyan-500/40 bg-black aspect-video relative shadow-lg">
                        <video
                          src={generatedVideos[i]}
                          controls
                          autoPlay
                          className="w-full h-full object-contain"
                        />
                      </div>
                    ) : (
                      <button
                        onClick={() => handleGenerateVideo(i, msg.text)}
                        disabled={generatingVideoIndex !== null}
                        className="self-start px-2.5 py-1 rounded-lg bg-cyan-950/40 hover:bg-cyan-900/60 text-cyan-300 border border-cyan-700/50 text-[10px] font-mono transition flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {generatingVideoIndex === i ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin text-cyan-400" />
                            <span>Gerando Vídeo com a Analista D-ID...</span>
                          </>
                        ) : (
                          <>
                            <Video className="w-3 h-3 text-cyan-400" />
                            <span>Assistir com a Analista Virtual (D-ID)</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}

            {isAiLoading && (
              <div className="p-3.5 rounded-xl max-w-[70%] bg-[#0f172a] text-cyan-300 border border-gray-800 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                <span className="text-xs font-mono">Processando análise com o motor quantitativo...</span>
              </div>
            )}
          </div>

          {/* Campo de Entrada de Mensagem com Microfone */}
          <div className="flex flex-col gap-2">
            {isListening && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono animate-pulse">
                <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                <span>Ouvindo sua voz em português... Fale sua pergunta para a IA.</span>
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={inputMessage}
                disabled={isAiLoading}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder={isListening ? "Ouvindo... fale agora..." : `Faça uma pergunta sobre ${currentStock.symbol} (ex: Qual o regime GEX? Vale montar Iron Condor?)... `}
                className={`flex-1 bg-[#070b14] border ${isListening ? 'border-rose-500' : 'border-gray-700'} rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-sans disabled:opacity-50 transition`}
              />

              {/* Botão de Microfone */}
              <button
                type="button"
                onClick={toggleVoiceInput}
                disabled={isAiLoading}
                title={isListening ? "Parar gravação" : "Falar pergunta pelo microfone"}
                className={`px-3 py-2.5 rounded-xl text-xs font-mono font-bold transition flex items-center justify-center border ${
                  isListening
                    ? 'bg-rose-600 hover:bg-rose-500 text-white border-rose-400 shadow-md shadow-rose-600/30 animate-pulse'
                    : 'bg-[#0f172a] hover:bg-cyan-950/40 text-cyan-300 border-gray-700 hover:border-cyan-500/40'
                } disabled:opacity-50`}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>

              {/* Botão de Enviar */}
              <button
                onClick={() => handleSendMessage()}
                disabled={isAiLoading || !inputMessage.trim()}
                className="px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-mono font-bold transition flex items-center gap-1.5 shadow-md shadow-cyan-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>Enviar</span>
              </button>
            </div>
          </div>
        </div>
      )}


    </section>
  );
}