'use client';

import React from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="pt-BR">
      <body className="bg-[#070b14] text-white flex items-center justify-center min-h-screen p-4">
        <div className="max-w-md w-full bg-[#0c1322] border border-gray-800 rounded-2xl p-6 text-center space-y-4 shadow-xl">
          <h2 className="text-lg font-bold text-white font-mono">Erro Crítico da Aplicação</h2>
          <p className="text-xs text-gray-400 font-sans">
            {error?.message || 'Falha ao inicializar o layout raiz do sistema.'}
          </p>
          <button
            onClick={() => reset()}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-mono font-bold transition mx-auto"
          >
            Recarregar Sistema
          </button>
        </div>
      </body>
    </html>
  );
}
