'use client';

import React, { useEffect, useState } from 'react';
import { Navbar, ActiveTab } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { HomeHubView } from '@/components/home/HomeHubView';
import { TradingViewOverview } from '@/components/tradingview/TradingViewOverview';
import { OpportunityRadarView } from '@/components/opportunities/OpportunityRadarView';
import { QuoteView } from '@/components/quote/QuoteView';
import { ScreenerView } from '@/components/screener/ScreenerView';
import { BarreirasGexView } from '@/components/options/BarreirasGexView';
import { SpecialStrategiesView } from '@/components/special-strategies/SpecialStrategiesView';
import { VolatilityAnalystView } from '@/components/volatility/VolatilityAnalystView';
import { HelpSupportView } from '@/components/help/HelpSupportView';
import { ShadowAuditView } from '@/components/shadow-audit/ShadowAuditView';

type ApiStatus = { status: 'ONLINE' | 'OFFLINE' | 'CHECANDO'; latencyMs: number | null };

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [selectedSymbol, setSelectedSymbol] = useState<string>('NVDA');
  const [apiStatus, setApiStatus] = useState<ApiStatus>({ status: 'CHECANDO', latencyMs: null });

  // Health check real da Tastytrade: checagem periódica a cada 60s
  useEffect(() => {
    let cancelled = false;

    const checkHealth = async () => {
      try {
        const res = await fetch('/api/health');
        const data = await res.json();
        if (cancelled) return;
        setApiStatus({
          status: data.status === 'ONLINE' ? 'ONLINE' : 'OFFLINE',
          latencyMs: typeof data.latencyMs === 'number' ? data.latencyMs : null,
        });
      } catch {
        if (!cancelled) setApiStatus({ status: 'OFFLINE', latencyMs: null });
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const handleSelectSymbolFromScreener = (symbol: string) => {
    setSelectedSymbol(symbol);
    setActiveTab('consulta');
  };

  const handleNavigateToGex = (symbol: string) => {
    setSelectedSymbol(symbol);
    setActiveTab('barreiras');
  };

  const handleBackToQuote = (symbol?: string) => {
    if (symbol) setSelectedSymbol(symbol);
    setActiveTab('consulta');
  };

  const handleBackToScreener = () => {
    setActiveTab('rastreador');
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#070b14] text-gray-100 selection:bg-emerald-500/30 selection:text-emerald-300">
      <Navbar activeTab={activeTab} onTabChange={setActiveTab} apiStatus={apiStatus} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Painel 1: Hub Central de Inteligência */}
        <div id="panel-home" role="tabpanel" className={activeTab === 'home' ? 'block' : 'hidden'}>
          {activeTab === 'home' && (
            <HomeHubView
              onSelectModule={(tab, symbol) => {
                if (symbol) {
                  setSelectedSymbol(symbol);
                }
                setActiveTab(tab);
              }}
            />
          )}
        </div>

        {/* Painel 2: Mercado & TradingView */}
        <div id="panel-mercado" role="tabpanel" className={activeTab === 'mercado' ? 'block' : 'hidden'}>
          {activeTab === 'mercado' && <TradingViewOverview />}
        </div>

        {/* Painel 3: Radar de Oportunidades */}
        <div id="panel-oportunidades" role="tabpanel" className={activeTab === 'oportunidades' ? 'block' : 'hidden'}>
          {activeTab === 'oportunidades' && (
            <OpportunityRadarView onSelectSymbol={handleSelectSymbolFromScreener} />
          )}
        </div>

        {/* Painel 4: Consulta & Raio-X do Ativo */}
        <div id="panel-consulta" role="tabpanel" className={activeTab === 'consulta' ? 'block' : 'hidden'}>
          {activeTab === 'consulta' && (
            <QuoteView 
              initialSymbol={selectedSymbol} 
              onNavigateToGex={handleNavigateToGex}
              onBackToScreener={handleBackToScreener}
            />
          )}
        </div>

        {/* Painel 5: Rastreador de Tendências */}
        <div id="panel-rastreador" role="tabpanel" className={activeTab === 'rastreador' ? 'block' : 'hidden'}>
          {activeTab === 'rastreador' && <ScreenerView onSelectSymbol={handleSelectSymbolFromScreener} />}
        </div>

        {/* Painel 6: Barreiras & Motor GEX com Subabas */}
        <div id="panel-barreiras" role="tabpanel" className={activeTab === 'barreiras' ? 'block' : 'hidden'}>
          {activeTab === 'barreiras' && (
            <BarreirasGexView 
              initialSymbol={selectedSymbol} 
              onSelectSymbol={(sym) => setSelectedSymbol(sym)}
              onBackToQuote={handleBackToQuote}
              onBackToScreener={handleBackToScreener}
            />
          )}
        </div>

        {/* Painel 7: Estratégias Especiais */}
        <div id="panel-estrategias-especiais" role="tabpanel" className={activeTab === 'estrategias-especiais' ? 'block' : 'hidden'}>
          {activeTab === 'estrategias-especiais' && (
            <SpecialStrategiesView onSelectSymbol={handleSelectSymbolFromScreener} />
          )}
        </div>

        {/* Painel 8: Analista de Volatilidade */}
        <div id="panel-analista-vol" role="tabpanel" className={activeTab === 'analista-vol' ? 'block' : 'hidden'}>
          {activeTab === 'analista-vol' && (
            <VolatilityAnalystView 
              onNavigateToQuote={handleSelectSymbolFromScreener}
              onNavigateToGex={handleNavigateToGex}
            />
          )}
        </div>

        {/* Painel 9: Modo Sombra (Paper Trading & Auditoria Manual) */}
        <div id="panel-auditoria-sombra" role="tabpanel" className={activeTab === 'auditoria-sombra' ? 'block' : 'hidden'}>
          {activeTab === 'auditoria-sombra' && <ShadowAuditView />}
        </div>

        {/* Painel 10: Manual & Ajuda IA */}
        <div id="panel-manual" role="tabpanel" className={activeTab === 'manual' ? 'block' : 'hidden'}>
          {activeTab === 'manual' && <HelpSupportView />}
        </div>
      </main>

      <Footer apiStatus={apiStatus} />
    </div>
  );
}