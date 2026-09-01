'use client';

import React, { useState } from 'react';
import { Navbar, ActiveTab } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { PanoramaView } from '@/components/panorama/PanoramaView';
import { QuoteView } from '@/components/quote/QuoteView';
import { ScreenerView } from '@/components/screener/ScreenerView';
import { BarreirasGexView } from '@/components/options/BarreirasGexView';
import { HelpSupportView } from '@/components/help/HelpSupportView';

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('panorama');
  const [selectedSymbol, setSelectedSymbol] = useState<string>('NVDA');

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
      <Navbar activeTab={activeTab} onTabChange={setActiveTab} uniqueVisitors={3} />

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

        <div id="panel-manual" role="tabpanel" className={activeTab === 'manual' ? 'block' : 'hidden'}>
          {activeTab === 'manual' && <HelpSupportView />}
        </div>
      </main>

      <Footer />
    </div>
  );
}