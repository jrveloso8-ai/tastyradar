import { NextRequest, NextResponse } from 'next/server';
import { didService } from '@/lib/services/did.service';
import { applyApiGuard, withSessionCookie } from '@/lib/security/api-guard';

export async function POST(request: NextRequest) {
  // Guarda de origem + rate limit compartilhada (Achados A-05/N-04/C-08).
  // Limite mais apertado que as demais rotas: cada chamada aciona o D-ID,
  // serviço pago por crédito — teto global evita exaustão financeira mesmo
  // que um atacante descarte o cookie de sessão a cada requisição.
  const guard = applyApiGuard(request, { maxRequestsPerKey: 3, windowMs: 60_000, globalMaxRequests: 60 });
  if (!guard.ok) return withSessionCookie(guard.response!, guard);

  try {
    const body = await request.json();
    const { text } = body;

    // Validação estrita de schema e tamanho de texto
    if (!text || typeof text !== 'string') {
      return withSessionCookie(
        NextResponse.json(
          { success: false, error: 'O parâmetro "text" é obrigatório.' },
          { status: 400 }
        ),
        guard
      );
    }

    const cleanText = text.trim();
    if (cleanText.length < 5 || cleanText.length > 350) {
      return withSessionCookie(
        NextResponse.json(
          { success: false, error: 'O texto deve conter entre 5 e 350 caracteres.' },
          { status: 400 }
        ),
        guard
      );
    }

    // Dispara a geração com sanitização, ignorando sourceUrl e voiceId arbitrários injetados
    const videoUrl = await didService.generateVideoAndWait(cleanText);

    return withSessionCookie(
      NextResponse.json({
        success: true,
        videoUrl,
      }),
      guard
    );
  } catch (error: any) {
    return withSessionCookie(
      NextResponse.json(
        {
          success: false,
          error: 'Falha temporária ao processar síntese de vídeo.',
        },
        { status: 500 }
      ),
      guard
    );
  }
}
