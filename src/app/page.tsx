'use client';

import React, { useEffect, useState } from 'react';
import { Navbar, ActiveTab } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { PanoramaView } from '@/components/panorama/PanoramaView';
import { QuoteView } from '@/components/quote/QuoteView';
import { ScreenerView } from '@/components/screener/ScreenerView';
import { BarreirasGexView } from '@/components/options/BarreirasGexView';
import { VolatilityAnalystView } from '@/components/volatility/VolatilityAnalystView';
import { HelpSupportView } from '@/components/help/HelpSupportView';

type ApiStatus = { status: 'ONLINE' | 'OFFLINE' | 'CHECANDO'; latencyMs: number | null };

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('panorama');
  const [selectedSymbol, setSelectedSymbol] = useState<string>('NVDA');
  const [apiStatus, setApiStatus] = useState<ApiStatus>({ status: 'CHECANDO', latencyMs: null });

  // Health check real da Tastytrade (Parte 3 do Lote 1, Achado D-02/C-05): substitui o
  // badge fixo "ONLINE 84ms" por uma checagem de fato, repetida a cada 60s. Uma falha de
  // rede/parse na checagem em si vira "OFFLINE" (não deixa o badge preso em "checando…").
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
        <div id="panel-panorama" role="tabpanel" className={activeTab === 'panorama' ? 'block' : 'hidden'}>
          {activeTab === 'panorama' && <PanoramaView />}
        </div>

        <div id="panel-consulta" role="tabpanel" className={activeTab === 'consulta' ? 'block' : 'hidden'}>
          {activeTab === 'consulta' && (
            <QuoteView 
              initialSymbol={selectedSymbol} 
              onNavigateToGex={handleNavigateToGex}
              onBackToScreener={handleBackToScreener}
            />
          )}
        </div>

        <div id="panel-rastreador" role="tabpanel" className={activeTab === 'rastreador' ? 'block' : 'hidden'}>
          {activeTab === 'rastreador' && <ScreenerView onSelectSymbol={handleSelectSymbolFromScreener} />}
        </div>

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

        <div id="panel-analista-vol" role="tabpanel" className={activeTab === 'analista-vol' ? 'block' : 'hidden'}>
          {activeTab === 'analista-vol' && (
            <VolatilityAnalystView 
              onNavigateToQuote={handleSelectSymbolFromScreener}
              onNavigateToGex={handleNavigateToGex}
            />
          )}
        </div>

        <div id="panel-manual" role="tabpanel" className={activeTab === 'manual' ? 'block' : 'hidden'}>
          {activeTab === 'manual' && <HelpSupportView />}
        </div>
      </main>

      <Footer apiStatus={apiStatus} />
    </div>
  );
}