import { NextRequest, NextResponse } from 'next/server';
import { didService } from '@/lib/services/did.service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, sourceUrl, voiceId } = body;

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { success: false, error: 'O parâmetro "text" é obrigatório.' },
        { status: 400 }
      );
    }

    // Dispara a geração e aguarda o vídeo .mp4 renderizado
    const videoUrl = await didService.generateVideoAndWait(text);

    return NextResponse.json({
      success: true,
      videoUrl,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Erro ao gerar vídeo com a analista virtual no D-ID.',
      },
      { status: 500 }
    );
  }
}
