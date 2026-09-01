import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'RADAR TASTYTRADE PRO IA - Terminal Quantitativo de Opções e Ações US',
  description: 'Sistema profissional de análise quantitativa de opções, Gamma Exposure (GEX) e cotações da bolsa americana integrado à Tastytrade Open API.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className="dark">
      <body className="min-h-screen flex flex-col bg-[#070b14] text-gray-100 antialiased selection:bg-emerald-500/30 selection:text-emerald-300">
        {children}
      </body>
    </html>
  );
}
