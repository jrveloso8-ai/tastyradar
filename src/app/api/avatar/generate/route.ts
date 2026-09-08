import { NextRequest, NextResponse } from 'next/server';
import { didService } from '@/lib/services/did.service';

// Rate limiter com evicção ativa TTL e limite de capacidade (Achados A-05 e N-04)
const MAX_RATE_LIMIT_ENTRIES = 500;
const requestCounts = new Map<string, { count: number; resetAt: number }>();

function cleanupExpiredEntries(now: number) {
  for (const [key, record] of requestCounts.entries()) {
    if (record.resetAt <= now) {
      requestCounts.delete(key);
    }
  }
  // Se ainda exceder o teto, remove as chaves mais antigas (LRU simples)
  if (requestCounts.size > MAX_RATE_LIMIT_ENTRIES) {
    const excess = requestCounts.size - MAX_RATE_LIMIT_ENTRIES;
    const keys = Array.from(requestCounts.keys()).slice(0, excess);
    keys.forEach((k) => requestCounts.delete(k));
  }
}

function checkRateLimit(key: string, maxRequests = 3, windowMs = 60_000): boolean {
  const now = Date.now();
  if (requestCounts.size >= MAX_RATE_LIMIT_ENTRIES / 2) {
    cleanupExpiredEntries(now);
  }

  const record = requestCounts.get(key);

  if (!record || record.resetAt <= now) {
    requestCounts.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (record.count >= maxRequests) {
    return false;
  }

  record.count++;
  return true;
}

function extractClientIp(request: NextRequest): string {
  // Dá preferência a headers de proxies reversos confiáveis (Cloudflare / Vercel / Nginx)
  const cfIp = request.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp.trim();

  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp.trim();

  // Em proxies encadeados, o último IP adicionado pelo ingress é o mais confiável contra spoofing de cliente
  const xff = request.headers.get('x-forwarded-for');
  if (xff) {
    const parts = xff.split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length > 0) {
      return parts[parts.length - 1];
    }
  }

  return '127.0.0.1';
}

export async function POST(request: NextRequest) {
  try {
    const clientIp = extractClientIp(request);

    // 1. Rate Limiting com chave confiável e proteção anti-exhaustion (Achados A-05 e N-04)
    if (!checkRateLimit(clientIp, 3, 60_000)) {
      return NextResponse.json(
        { success: false, error: 'Limite de requisições excedido. Aguarde 1 minuto.' },
        { status: 429 }
      );
    }

    // 2. Verificação de Origem e Proteção CSRF / Cross-Site (Achado N-04)
    const origin = request.headers.get('origin');
    const referer = request.headers.get('referer');
    const host = request.headers.get('host') || '';
    const secFetchSite = request.headers.get('sec-fetch-site');
    const authHeader = request.headers.get('authorization') || request.headers.get('x-api-key');
    const internalSecret = process.env.INTERNAL_API_SECRET;

    // Bloqueia tentativas explícitas de cross-site via navegador
    if (secFetchSite === 'cross-site') {
      return NextResponse.json(
        { success: false, error: 'Requisição cross-origin não autorizada.' },
        { status: 403 }
      );
    }

    // Se houver segredo interno configurado, aceita com bearer
    const isAuthorizedBySecret = internalSecret && authHeader === `Bearer ${internalSecret}`;

    // Requisições de browser devem possuir origin ou referer compatível com o host
    const isOriginValid = origin && (origin.includes(host) || origin.includes('localhost'));
    const isRefererValid = referer && (referer.includes(host) || referer.includes('localhost'));

    if (!isAuthorizedBySecret && !isOriginValid && !isRefererValid) {
      return NextResponse.json(
        { success: false, error: 'Origem ou autenticação inválida.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { text } = body;

    // 3. Validação estrita de schema e tamanho de texto
    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { success: false, error: 'O parâmetro "text" é obrigatório.' },
        { status: 400 }
      );
    }

    const cleanText = text.trim();
    if (cleanText.length < 5 || cleanText.length > 350) {
      return NextResponse.json(
        { success: false, error: 'O texto deve conter entre 5 e 350 caracteres.' },
        { status: 400 }
      );
    }

    // Dispara a geração com sanitização, ignorando sourceUrl e voiceId arbitrários injetados
    const videoUrl = await didService.generateVideoAndWait(cleanText);

    return NextResponse.json({
      success: true,
      videoUrl,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: 'Falha temporária ao processar síntese de vídeo.',
      },
      { status: 500 }
    );
  }
}
