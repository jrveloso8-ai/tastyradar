'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  LayoutDashboard,
  Globe,
  TrendingUp,
  BarChart3,
  ShieldCheck,
} from 'lucide-react';

export const TradingViewOverview: React.FC = () => {
  const tickerTapeRef = useRef<HTMLDivElement>(null);
  const marketOverviewRef = useRef<HTMLDivElement>(null);

  // Inicialização do Ticker Tape com ativos do mercado americano
  useEffect(() => {
    if (tickerTapeRef.current && !tickerTapeRef.current.hasChildNodes()) {
      const script = document.createElement('script');
      script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js';
      script.async = true;
      script.type = 'text/javascript';
      script.innerHTML = JSON.stringify({
        symbols: [
          { proName: 'AMEX:SPY', title: 'S&P 500 (SPY)' },
          { proName: 'NASDAQ:QQQ', title: 'NASDAQ 100 (QQQ)' },
          { proName: 'AMEX:IWM', title: 'RUSSELL 2000' },
          { proName: 'AMEX:DIA', title: 'DOW JONES' },
          { proName: 'CBOE:VIX', title: 'VIX VOLATILITY' },
          { proName: 'NASDAQ:NVDA', title: 'NVIDIA' },
          { proName: 'NASDAQ:AAPL', title: 'APPLE' },
          { proName: 'NASDAQ:MSFT', title: 'MICROSOFT' },
          { proName: 'NASDAQ:AMZN', title: 'AMAZON' },
          { proName: 'NASDAQ:GOOGL', title: 'ALPHABET' },
          { proName: 'NASDAQ:META', title: 'META' },
          { proName: 'NASDAQ:TSLA', title: 'TESLA' },
          { proName: 'NASDAQ:TLT', title: '20+ YR TREASURY' },
          { proName: 'TVC:GOLD', title: 'GOLD SPOT' },
        ],
        showSymbolLogo: true,
        isTransparent: false,
        displayMode: 'adaptive',
        colorTheme: 'dark',
        locale: 'en',
      });
      tickerTapeRef.current.appendChild(script);
    }
  }, []);

  // Inicialização do Market Overview Widget Oficial do TradingView para o mercado US
  useEffect(() => {
    const container = marketOverviewRef.current;
    if (!container) return;

    if (container.querySelector('iframe') || container.querySelector('script')) {
      return;
    }

    container.innerHTML = '<div class="tradingview-widget-container__widget"></div>';
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-market-overview.js';
    script.async = true;
    script.type = 'text/javascript';
    script.innerHTML = JSON.stringify({
      colorTheme: 'dark',
      dateRange: '12M',
      showChart: true,
      locale: 'en',
      width: '100%',
      height: '680',
      largeChartUrl: '',
      isTransparent: false,
      showSymbolLogo: true,
      showFloatingTooltip: true,
      plotLineColorGrowing: 'rgba(34, 197, 94, 1)',
      plotLineColorFalling: 'rgba(239, 68, 68, 1)',
      gridLineColor: 'rgba(31, 41, 55, 0.5)',
      scaleFontColor: 'rgba(156, 163, 175, 1)',
      belowLineFillColorGrowing: 'rgba(34, 197, 94, 0.12)',
      belowLineFillColorFalling: 'rgba(239, 68, 68, 0.12)',
      symbolActiveColor: 'rgba(16, 185, 129, 0.15)',
      tabs: [
        {
          title: 'Principais Índices & ETFs US',
          symbols: [
            { s: 'AMEX:SPY', d: 'SPDR S&P 500 ETF' },
            { s: 'NASDAQ:QQQ', d: 'Invesco QQQ Trust' },
            { s: 'AMEX:IWM', d: 'iShares Russell 2000' },
            { s: 'AMEX:DIA', d: 'SPDR Dow Jones Industrial' },
            { s: 'CBOE:VIX', d: 'CBOE Volatility Index' },
            { s: 'NASDAQ:TLT', d: 'iShares 20+ Year Treasury' },
          ],
        },
        {
          title: 'Mega-Cap Equities US',
          symbols: [
            { s: 'NASDAQ:NVDA', d: 'NVIDIA Corp.' },
            { s: 'NASDAQ:AAPL', d: 'Apple Inc.' },
            { s: 'NASDAQ:MSFT', d: 'Microsoft Corp.' },
            { s: 'NASDAQ:AMZN', d: 'Amazon.com Inc.' },
            { s: 'NASDAQ:GOOGL', d: 'Alphabet Inc. Cl A' },
            { s: 'NASDAQ:META', d: 'Meta Platforms Inc.' },
            { s: 'NASDAQ:TSLA', d: 'Tesla Inc.' },
          ],
        },
        {
          title: 'Macro, Yields & Commodities',
          symbols: [
            { s: 'TVC:US10Y', d: 'US 10 Year Yield' },
            { s: 'CAPITALCOM:DXY', d: 'US Dollar Index' },
            { s: 'TVC:GOLD', d: 'Gold Spot / USD' },
            { s: 'TVC:USOIL', d: 'WTI Crude Oil' },
            { s: 'CRYPTOCAP:BTC', d: 'Bitcoin / USD' },
          ],
        },
      ],
    });
    container.appendChild(script);
  }, []);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Ticker Tape Superior (Widget Oficial TradingView) */}
      <div className="rounded-2xl overflow-hidden border border-gray-800 bg-[#111827] shadow-xl">
        <div ref={tickerTapeRef} className="tradingview-widget-container" />
      </div>

      {/* Cabeçalho da Visão */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0b101b] border border-gray-800 p-4 rounded-2xl shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <LayoutDashboard className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white font-mono tracking-wide">
              MERCADO AMERICANO & TRADINGVIEW
            </h2>
            <p className="text-xs text-gray-400">
              Cotações em tempo real via feeds diretos dos mercados de Nova York (NYSE, NASDAQ, CBOE)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-semibold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            FEEDS LIVE TRADINGVIEW
          </span>
        </div>
      </div>

      {/* Widget Principal: Market Overview Interativo */}
      <div className="rounded-2xl border border-gray-800 bg-[#0c121e] p-4 shadow-2xl">
        <div ref={marketOverviewRef} className="tradingview-widget-container min-h-[680px]" />
      </div>

      {/* Governança do Dado */}
      <div className="flex items-center justify-between p-4 rounded-xl border border-gray-800/80 bg-[#090e18] text-xs text-gray-400">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Proveniência: Feed oficial de mercado embed via TradingView SDK CDN</span>
        </div>
        <span className="font-mono text-[11px] text-gray-500">NYSE • NASDAQ • CBOE Data Feeds</span>
      </div>
    </div>
  );
};
