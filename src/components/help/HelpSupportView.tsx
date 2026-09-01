'use client';

import React, { useState } from 'react';
import { BookOpen, ChevronDown, Bot, Send, PlayCircle, Play, Loader2, Sparkles, Shield, HelpCircle, Video, Mic, MicOff } from 'lucide-react';
import { aiConsultantEngine } from '@/lib/domain/ai-consultant';

export function HelpSupportView() {
  const [openTopic, setOpenTopic] = useState<number | null>(1);
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant'; text: string }>>([
    {
      role: 'assistant',
      text: 'Olá! Sou o Consultor Quantitativo IA do RADAR. Posso esclarecer qualquer dúvida sobre o manual operacional, Gamma Exposure (GEX), o crivo fundamentalista CNPI-P normalizado, as 25 estratégias de opções CME ou regras de gestão de risco. O que deseja saber?',
    },
  ]);
  const [inputMessage, setInputMessage] = useState('');
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



  const topics = [
    {
      id: 1,
      title: 'Arquitetura das 4 Camadas de Decisão Quantitativa',
      subtitle: 'Visão Geral do Modelo Determinístico',
      content: 'O sistema combina de forma estrita 4 camadas independentes: 1) Crivo Fundamentalista CNPI-P Normalizado (Rentabilidade 35%, Solvência 35%, Valuation 30%), 2) Análise Técnica CNPI-T (Médias 9/21/200, Stops e Alvos R:R ≥ 2:1), 3) Estrutura de Mercado & Gamma Exposure (GEX) em tempo real via Tastytrade, e 4) Catálogo CME de 25 Estratégias de Opções.',
    },
    {
      id: 2,
      title: 'O que é Gamma Exposure (GEX) e Zero Gamma Flip',
      subtitle: 'Mecânica de Formadores de Mercado (Market Makers)',
      content: 'GEX mede o rebalanceamento de Delta dos Market Makers. Quando o preço está acima do Zero Gamma Flip (+GEX), os MMs operam contra a tendência (comprando na queda e vendendo na alta), comprimindo a volatilidade. Abaixo do Zero Gamma (-GEX), operam a favor da tendência, amplificando quedas e acelerações direcionais.',
    },
    {
      id: 3,
      title: 'Normalização Contábil por FCO e Dívida Financeira Real',
      subtitle: 'Auditoria e Sanidade Fundamentalista',
      content: 'Diferente de sistemas convencionais, o RADAR cruza DRE com DFC. Se uma empresa (ex: VALE3) sofre uma baixa não-caixa (impairment de R$ 25,1 bi) mas mantém geração de caixa operacional forte (FCO R$ 50,6 bi), o lucro é normalizado para pontuação. Além disso, a Dívida Líquida isola passivos IFRS-16 e provisões socioambientais para refletir a alavancagem financeira real (0,8x vs 3,09x bruto).',
    },
    {
      id: 4,
      title: 'Rastreador de Tendências & Execução de Iron Condor',
      subtitle: 'Classificação Alta / Baixa / Lateral',
      content: 'O rastreador classifica ativos em 3 regimes: compras direcionais em tendências claras de alta, travas de baixa com opções em tendências baixistas, e operações estruturadas de renda lateral (Iron Condor #20 a crédito com 4 pernas) quando o IV Rank for favorável.',
    },
  ];

  const handleSendMessage = async (customText?: string) => {
    const textToSend = (typeof customText === 'string' ? customText : inputMessage).trim();
    if (!textToSend || isAiLoading) return;
    setInputMessage('');
    setChatMessages((prev) => [...prev, { role: 'user', text: textToSend }]);
    setIsAiLoading(true);

    try {
      const response = await aiConsultantEngine.consult(textToSend, {
        symbol: 'SPX',
        spotPrice: 6000,
        category: 'LATERAL',
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
          text: `Erro ao consultar a IA: ${err?.message || 'Tente novamente em instantes.'}`,
        },
      ]);
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <section className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Coluna Esquerda: Manual e Tópicos */}
        <div className="lg:col-span-6 space-y-3">
          <div className="p-4 rounded-xl bg-[#0c1322] border border-gray-800 shadow-md">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-emerald-400" />
              Manual de Operações & Metodologia Quantitativa (Radar + GEX)
            </h3>
            <p className="text-xs text-gray-400 mt-1">
              Guia detalhado de como o sistema analisa tendências, valida fundamentos, calcula o Gamma Exposure e estrutura posições com a Tastytrade.
            </p>
          </div>

          <div className="space-y-2 font-mono text-xs">
            {topics.map((t) => (
              <div key={t.id} className="bg-[#0c1322] border border-gray-800 rounded-xl overflow-hidden transition hover:border-gray-700">
                <button
                  onClick={() => setOpenTopic(openTopic === t.id ? null : t.id)}
                  className="w-full p-3.5 text-left flex items-center justify-between hover:bg-slate-800/40"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-lg bg-[#070b14] border border-gray-700 text-cyan-400 flex items-center justify-center font-bold text-xs">
                      {String(t.id).padStart(2, '0')}
                    </span>
                    <div>
                      <div className="font-bold text-white font-sans">{t.title}</div>
                      <div className="text-[10px] text-gray-400 font-sans">{t.subtitle}</div>
                    </div>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${openTopic === t.id ? 'rotate-180' : ''}`} />
                </button>
                {openTopic === t.id && (
                  <div className="p-4 pt-2 text-[11px] text-gray-300 font-sans border-t border-gray-800/60 leading-relaxed bg-[#090e18]">
                    {t.content}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Card de Vídeo Aula Oficial Gravada */}
          <div className="bg-[#0c1322] border border-gray-800 rounded-2xl p-4 space-y-3 shadow-md">
            <div className="flex justify-between items-center border-b border-gray-800 pb-2">
              <div className="flex items-center gap-2">
                <PlayCircle className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold font-mono text-white">Vídeo Oficial: RADAR PRO QUANT + GEX</span>
              </div>
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-mono font-bold border border-emerald-500/30">
                DISPONÍVEL
              </span>
            </div>

            <div className="w-full rounded-xl overflow-hidden border border-gray-800 bg-black aspect-video relative shadow-lg">
              <video
                src="/RADAR_PRO_QUANT.mp4"
                controls
                playsInline
                preload="metadata"
                className="w-full h-full object-contain"
              >
                Seu navegador não suporta a reprodução de vídeo.
              </video>
            </div>
            <div className="flex justify-between items-center text-[10px] text-gray-400 font-mono pt-1">
              <span className="text-gray-400 font-sans">Gravação Oficial do Sistema</span>
              <span className="text-cyan-400">RADAR_PRO_QUANT.mp4</span>
            </div>
          </div>
        </div>


        {/* Coluna Direita: Consultor IA Interativo */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-[#0c1322] border border-gray-800 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl flex flex-col h-full">
            <div className="flex justify-between items-center border-b border-gray-800 pb-3">
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-purple-400 animate-pulse" />
                <div>
                  <h3 className="text-xs sm:text-sm font-bold font-mono text-white">Consultor IA & Dúvidas Operacionais</h3>
                  <p className="text-[10px] text-gray-400 font-sans">Tire dúvidas sobre métricas, GEX, travas de opções e gestão de risco.</p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[10px] font-mono font-bold border border-purple-500/40">
                ONLINE
              </span>
            </div>

            {/* Chips de Dúvidas Frequentes */}
            <div className="flex flex-wrap gap-1.5">
              <button
                disabled={isAiLoading}
                onClick={() => handleSendMessage('O que é GEX e como funciona o Gamma Exposure dos Market Makers?')}
                className="px-2.5 py-1 rounded-lg bg-[#070b14] hover:bg-purple-950/40 text-purple-300 border border-gray-800 hover:border-purple-600/50 text-[11px] font-mono transition flex items-center gap-1 disabled:opacity-50"
              >
                <span>📊 O que é GEX?</span>
              </button>
              <button
                disabled={isAiLoading}
                onClick={() => handleSendMessage('Como funciona o Zero Gamma Flip Point e a aceleração de volatilidade?')}
                className="px-2.5 py-1 rounded-lg bg-[#070b14] hover:bg-purple-950/40 text-purple-300 border border-gray-800 hover:border-purple-600/50 text-[11px] font-mono transition flex items-center gap-1 disabled:opacity-50"
              >
                <span>⚡ Zero Gamma Flip</span>
              </button>
              <button
                disabled={isAiLoading}
                onClick={() => handleSendMessage('Como o Crivo Fundamentalista CNPI-P normaliza baixas contábeis e dívida financeira?')}
                className="px-2.5 py-1 rounded-lg bg-[#070b14] hover:bg-purple-950/40 text-purple-300 border border-gray-800 hover:border-purple-600/50 text-[11px] font-mono transition flex items-center gap-1 disabled:opacity-50"
              >
                <span>🏛️ Crivo CNPI-P Normalizado</span>
              </button>
              <button
                disabled={isAiLoading}
                onClick={() => handleSendMessage('Como montar um Iron Condor a crédito com opções de acordo com o catálogo CME?')}
                className="px-2.5 py-1 rounded-lg bg-[#070b14] hover:bg-purple-950/40 text-purple-300 border border-gray-800 hover:border-purple-600/50 text-[11px] font-mono transition flex items-center gap-1 disabled:opacity-50"
              >
                <span>🦅 Como montar Iron Condor?</span>
              </button>
              <button
                disabled={isAiLoading}
                onClick={() => handleSendMessage('Quais as regras oficiais de gestão de risco e manejo de Stop Loss no sistema?')}
                className="px-2.5 py-1 rounded-lg bg-[#070b14] hover:bg-purple-950/40 text-purple-300 border border-gray-800 hover:border-purple-600/50 text-[11px] font-mono transition flex items-center gap-1 disabled:opacity-50"
              >
                <span>🛡️ Gestão de Risco CNPI</span>
              </button>
            </div>

            {/* Caixa de Histórico de Conversa */}
            <div className="bg-[#070b14] border border-gray-800/80 rounded-xl p-3.5 h-80 overflow-y-auto space-y-3 font-sans text-xs flex-1">
              {chatMessages.map((msg, i) => (
                <div
                  key={i}
                  className={`p-3 rounded-xl max-w-[90%] leading-relaxed ${
                    msg.role === 'user'
                      ? 'ml-auto bg-purple-600 text-white font-medium shadow-md shadow-purple-600/10'
                      : 'bg-[#0f172a] text-gray-200 border border-gray-800 space-y-2'
                  }`}
                >
                  {msg.text.split('\n').map((line, lineIdx) => {
                    if (line.startsWith('### ')) {
                      return <h4 key={lineIdx} className="text-xs font-bold text-purple-300 font-mono mt-1 mb-1">{line.replace('### ', '')}</h4>;
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
                        <div className="rounded-xl overflow-hidden border border-purple-500/40 bg-black aspect-video relative shadow-lg">
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
                          className="self-start px-2.5 py-1 rounded-lg bg-purple-950/40 hover:bg-purple-900/60 text-purple-300 border border-purple-700/50 text-[10px] font-mono transition flex items-center gap-1.5 disabled:opacity-50"
                        >
                          {generatingVideoIndex === i ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin text-purple-400" />
                              <span>Gerando Vídeo com a Analista D-ID...</span>
                            </>
                          ) : (
                            <>
                              <Video className="w-3 h-3 text-purple-400" />
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
                <div className="p-3 rounded-xl max-w-[80%] bg-[#0f172a] text-purple-300 border border-gray-800 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                  <span className="text-xs font-mono">Consultando base de conhecimento quantitativo...</span>
                </div>
              )}
            </div>

            {/* Input e Botão de Envio com Microfone */}
            <div className="flex flex-col gap-2 pt-1">
              {isListening && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono animate-pulse">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                  <span>Ouvindo sua voz em português... Pode falar a sua pergunta.</span>
                </div>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inputMessage}
                  disabled={isAiLoading}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder={isListening ? "Ouvindo... fale agora..." : "Faça uma pergunta sobre o manual ou GEX (ex: o que é GEX ?)..."}
                  className={`flex-1 bg-[#070b14] border ${isListening ? 'border-rose-500' : 'border-gray-700'} rounded-xl pl-4 pr-4 py-2.5 text-xs font-sans text-white focus:outline-none focus:border-purple-500 disabled:opacity-50 transition`}
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
                      : 'bg-[#0f172a] hover:bg-purple-950/40 text-purple-300 border-gray-700 hover:border-purple-500/40'
                  } disabled:opacity-50`}
                >
                  {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>

                {/* Botão de Envio */}
                <button
                  onClick={() => handleSendMessage()}
                  disabled={isAiLoading || !inputMessage.trim()}
                  className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white transition disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-purple-600/20 flex items-center gap-1.5 text-xs font-mono font-bold"
                >
                  {isAiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>Enviar</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}