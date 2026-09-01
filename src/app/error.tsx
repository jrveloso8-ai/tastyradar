'use client';

import React, { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('App Runtime Error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#070b14] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-[#0c1322] border border-gray-800 rounded-2xl p-6 text-center space-y-4 shadow-xl">
        <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/40 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white font-mono">Erro de Execução</h2>
          <p className="text-xs text-gray-400 mt-1 font-sans">
            {error?.message || 'Ocorreu um erro inesperado ao carregar a página.'}
          </p>
        </div>
        <button
          onClick={() => reset()}
          className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-mono font-bold transition flex items-center justify-center gap-2 mx-auto shadow-md shadow-cyan-600/20"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Tentar Novamente</span>
        </button>
      </div>
    </div>
  );
}
