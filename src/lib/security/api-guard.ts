import { NextRequest, NextResponse } from 'next/server';

/**
 * Guarda de API compartilhada: validação de origem + rate limit em camadas.
 *
 * REGRA 00 aplicada à segurança: não afirme uma proteção que o código não
 * sustenta. Rate limit chaveado em `x-forwarded-for`/`cf-connecting-ip` só é
 * confiável quando o deploy está comprovadamente atrás de um proxy que
 * reescreve esses headers na borda (Vercel ou Cloudflare) — sem isso, um
 * chamador pode anunciar um IP novo a cada requisição e o limite se torna
 * decorativo. Configure `TRUSTED_PROXY=vercel` ou `TRUSTED_PROXY=cloudflare`
 * no ambiente quando o deploy estiver de fato atrás de um desses.
 *
 * Enquanto `TRUSTED_PROXY` não estiver configurado (`'none'`, o padrão), a
 * defesa soma três camadas independentes em vez de confiar só em IP:
 *   1. Validação de origem (Origin/Referer/Sec-Fetch-Site) — bloqueia abuso
 *      simples disparado do navegador a partir de outro site.
 *   2. Rate limit por sessão (cookie `__radar_sid`) — exige que o abusador
 *      reutilize o mesmo cookie entre chamadas.
 *   3. Teto global por janela de tempo — rede de segurança final, já que um
 *      atacante determinado pode descartar o cookie a cada chamada.
 * Nenhuma dessas camadas substitui autenticação real. Para automações
 * legítimas fora do navegador (servidor-a-servidor), use `INTERNAL_API_SECRET`
 * como Bearer token — isso dispensa a checagem de origem, mas ainda passa
 * pelo rate limit.
 */

export type TrustedProxy = 'vercel' | 'cloudflare' | 'none';

const MAX_RATE_LIMIT_ENTRIES = 1000;
const requestCounts = new Map<string, { count: number; resetAt: number }>();
let globalWindowCount = 0;
let globalWindowResetAt = 0;

function cleanupExpiredEntries(now: number) {
  for (const [key, record] of requestCounts.entries()) {
    if (record.resetAt <= now) requestCounts.delete(key);
  }
  if (requestCounts.size > MAX_RATE_LIMIT_ENTRIES) {
    const excess = requestCounts.size - MAX_RATE_LIMIT_ENTRIES;
    const keys = Array.from(requestCounts.keys()).slice(0, excess);
    keys.forEach((k) => requestCounts.delete(k));
  }
}

function checkKeyedRateLimit(key: string, maxRequests: number, windowMs: number, now: number): boolean {
  if (requestCounts.size >= MAX_RATE_LIMIT_ENTRIES / 2) cleanupExpiredEntries(now);

  const record = requestCounts.get(key);
  if (!record || record.resetAt <= now) {
    requestCounts.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (record.count >= maxRequests) return false;
  record.count++;
  return true;
}

function checkGlobalCeiling(maxRequests: number, windowMs: number, now: number): boolean {
  if (globalWindowResetAt <= now) {
    globalWindowCount = 1;
    globalWindowResetAt = now + windowMs;
    return true;
  }
  if (globalWindowCount >= maxRequests) return false;
  globalWindowCount++;
  return true;
}

function getTrustedProxy(): TrustedProxy {
  const v = (process.env.TRUSTED_PROXY || '').toLowerCase();
  if (v === 'vercel' || v === 'cloudflare') return v;
  return 'none';
}

/**
 * Só devolve um IP quando o proxy configurado é comprovadamente confiável
 * para o header em questão. Nunca cai para `x-forwarded-for` sem proxy
 * declarado — essa era a falha original (Achados N-04/C-08).
 */
function extractTrustedIp(request: NextRequest, proxy: TrustedProxy): string | null {
  if (proxy === 'cloudflare') {
    const cfIp = request.headers.get('cf-connecting-ip');
    return cfIp ? cfIp.trim() : null;
  }
  if (proxy === 'vercel') {
    // Na borda da Vercel, o primeiro IP de x-forwarded-for é o cliente real.
    const xff = request.headers.get('x-forwarded-for');
    const first = xff?.split(',')[0]?.trim();
    return first || null;
  }
  return null;
}

const SESSION_COOKIE = '__radar_sid';

function getSessionKey(request: NextRequest): { key: string; isNew: boolean } {
  const existing = request.cookies.get(SESSION_COOKIE)?.value;
  if (existing) return { key: existing, isNew: false };
  return { key: crypto.randomUUID(), isNew: true };
}

function isTrustedOrigin(request: NextRequest): boolean {
  const secFetchSite = request.headers.get('sec-fetch-site');

  // Sec-Fetch-Site é definido pelo navegador e não pode ser sobrescrito por
  // JavaScript da página — é o sinal mais confiável disponível sem proxy.
  if (secFetchSite === 'same-origin' || secFetchSite === 'same-site') return true;
  if (secFetchSite === 'cross-site') return false;

  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  const host = request.headers.get('host') || '';

  if (!origin && !referer) return false; // sem nenhuma evidência de chamada same-origin de navegador

  const isOriginValid = !!origin && (origin.includes(host) || origin.includes('localhost'));
  const isRefererValid = !!referer && (referer.includes(host) || referer.includes('localhost'));
  return isOriginValid || isRefererValid;
}

export interface ApiGuardOptions {
  /** Requisições permitidas por chave (IP confiável ou sessão) na janela. */
  maxRequestsPerKey?: number;
  windowMs?: number;
  /** Teto agregado quando não há IP confiável (proxy === 'none'). */
  globalMaxRequests?: number;
  /** Desliga a checagem de origem — use só se a rota já tiver outra autenticação. */
  requireOrigin?: boolean;
}

export interface ApiGuardResult {
  ok: boolean;
  response?: NextResponse;
  /** Se definido, o chamador deve gravar este cookie de sessão na resposta de sucesso. */
  newSessionCookie?: string;
}

export function applyApiGuard(request: NextRequest, options: ApiGuardOptions = {}): ApiGuardResult {
  const {
    maxRequestsPerKey = 20,
    windowMs = 60_000,
    globalMaxRequests = 300,
    requireOrigin = true,
  } = options;

  const now = Date.now();
  const internalSecret = process.env.INTERNAL_API_SECRET;
  const authHeader = request.headers.get('authorization') || request.headers.get('x-api-key');
  const isAuthorizedBySecret = !!internalSecret && authHeader === `Bearer ${internalSecret}`;

  if (requireOrigin && !isAuthorizedBySecret && !isTrustedOrigin(request)) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: 'Origem ou autenticação inválida.' },
        { status: 403 }
      ),
    };
  }

  const proxy = getTrustedProxy();
  const trustedIp = extractTrustedIp(request, proxy);

  let rateLimitKey: string;
  let newSessionCookie: string | undefined;

  if (trustedIp) {
    rateLimitKey = trustedIp;
  } else {
    const session = getSessionKey(request);
    rateLimitKey = session.key;
    if (session.isNew) newSessionCookie = session.key;
  }

  if (!checkKeyedRateLimit(rateLimitKey, maxRequestsPerKey, windowMs, now)) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: 'Limite de requisições excedido. Aguarde e tente novamente.' },
        { status: 429 }
      ),
      newSessionCookie,
    };
  }

  // Rede de segurança final: sem IP confiável, um atacante pode descartar o
  // cookie de sessão a cada chamada e burlar o limite por chave sozinho.
  if (!trustedIp && !checkGlobalCeiling(globalMaxRequests, windowMs, now)) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: 'Serviço temporariamente sob alta demanda. Tente novamente em instantes.' },
        { status: 429 }
      ),
      newSessionCookie,
    };
  }

  return { ok: true, newSessionCookie };
}

/** Grava o cookie de sessão de rate limit numa resposta de sucesso, se necessário. */
export function withSessionCookie(response: NextResponse, guard: ApiGuardResult): NextResponse {
  if (guard.newSessionCookie) {
    response.cookies.set(SESSION_COOKIE, guard.newSessionCookie, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60,
      path: '/',
    });
  }
  return response;
}
