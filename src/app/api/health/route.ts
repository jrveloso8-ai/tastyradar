import { NextRequest, NextResponse } from 'next/server';
import { applyApiGuard, withSessionCookie } from '@/lib/security/api-guard';
import { tastyAuthService } from '@/lib/services/tastytrade-auth.service';

/**
 * Health check real da integração Tastytrade, usado por Navbar/Footer (Parte 3 do Lote 1
 * de remediação, Ciclo 4 — Achado D-02/C-05). Antes o badge "ONLINE 84ms" era uma
 * constante fixa no componente, sem checar nada; agora mede o tempo de uma autenticação
 * real (`tastyAuthService.getAccessToken()`, com cache — não gera token novo a cada
 * checagem). Sucesso = credenciais válidas e API da Tastytrade respondendo. Isso NÃO
 * confirma um stream DXLink ativo (não há client de streaming implementado no projeto
 * hoje) — por isso o rótulo "DXLink Realtime" foi removido de Navbar/Footer nesta mesma
 * etapa, em vez de deixar uma alegação sem sustentação no código.
 */
export async function GET(request: NextRequest) {
  const guard = applyApiGuard(request, { maxRequestsPerKey: 30, windowMs: 60_000, globalMaxRequests: 600 });
  if (!guard.ok) return withSessionCookie(guard.response!, guard);

  const start = Date.now();
  try {
    await tastyAuthService.getAccessToken();
    const latencyMs = Date.now() - start;
    return withSessionCookie(
      NextResponse.json({
        success: true,
        status: 'ONLINE',
        latencyMs,
        checkedAt: new Date().toISOString(),
      }),
      guard
    );
  } catch (err: any) {
    const latencyMs = Date.now() - start;
    // 200 é intencional: esta É a resposta de health check, "OFFLINE" é um resultado
    // válido do diagnóstico, não uma falha da própria rota.
    return withSessionCookie(
      NextResponse.json({
        success: true,
        status: 'OFFLINE',
        latencyMs,
        error: 'Falha ao autenticar com a Tastytrade (credenciais ausentes/expiradas ou API indisponível).',
        checkedAt: new Date().toISOString(),
      }),
      guard
    );
  }
}
