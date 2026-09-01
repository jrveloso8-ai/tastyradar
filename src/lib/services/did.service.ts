export interface DidTalkRequest {
  text: string;
  sourceUrl?: string;
  voiceId?: string;
}

export interface DidTalkResponse {
  id: string;
  status: 'created' | 'started' | 'done' | 'error';
  result_url?: string;
  error?: string;
}

export class DidService {
  private baseUrl = 'https://api.d-id.com';
  private apiKey: string;
  // Avatar profissional institucional de analista de mercado oficial suportado pelo D-ID
  private defaultAvatarUrl = 'https://d-id-public-bucket.s3.us-west-2.amazonaws.com/alice.jpg';
  // Voz neural brasileira da Microsoft
  private defaultVoiceId = 'pt-BR-FranciscaNeural';


  constructor() {
    this.apiKey = process.env.DID_API_KEY || '';
  }

  private getAuthHeader(): string {
    if (!this.apiKey) {
      throw new Error('Chave DID_API_KEY não configurada no ambiente.');
    }
    // D-ID aceita formato Basic Auth com a chave em base64 (key:secret)
    const base64Auth = Buffer.from(this.apiKey).toString('base64');
    return `Basic ${base64Auth}`;
  }

  /**
   * Inicia a geração de um vídeo com a analista falando o texto fornecido.
   */
  async createTalk(params: DidTalkRequest): Promise<{ id: string; status: string }> {
    const authHeader = this.getAuthHeader();

    // Limita o texto falado para sintetização ideal
    const cleanText = params.text
      .replace(/###/g, '')
      .replace(/\*\*/g, '')
      .replace(/•/g, '')
      .replace(/`/g, '')
      .trim()
      .slice(0, 800); // Primeiros 800 caracteres para geração rápida

    const payload = {
      source_url: params.sourceUrl || this.defaultAvatarUrl,
      script: {
        type: 'text',
        subtitles: false,
        provider: {
          type: 'microsoft',
          voice_id: params.voiceId || this.defaultVoiceId,
        },
        input: cleanText,
      },
      config: {
        fluent: true,
        pad_audio: 0.0,
      },
    };

    const response = await fetch(`${this.baseUrl}/talks`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`D-ID API Error (${response.status}): ${errorData?.message || response.statusText}`);
    }

    const data = await response.json();
    return {
      id: data.id,
      status: data.status,
    };
  }

  /**
   * Consulta o status de processamento do vídeo no D-ID.
   */
  async getTalk(talkId: string): Promise<DidTalkResponse> {
    const authHeader = this.getAuthHeader();

    const response = await fetch(`${this.baseUrl}/talks/${talkId}`, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`D-ID API Error (${response.status}): ${errorData?.message || response.statusText}`);
    }

    const data = await response.json();
    return {
      id: data.id,
      status: data.status,
      result_url: data.result_url,
      error: data.error?.description,
    };
  }

  /**
   * Dispara a geração e aguarda até que o vídeo .mp4 esteja pronto.
   */
  async generateVideoAndWait(text: string, maxWaitMs = 25000): Promise<string> {
    const { id } = await this.createTalk({ text });
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const talk = await this.getTalk(id);

      if (talk.status === 'done' && talk.result_url) {
        return talk.result_url;
      }
      if (talk.status === 'error') {
        throw new Error(`Falha na renderização do vídeo D-ID: ${talk.error || 'Erro desconhecido'}`);
      }
    }

    throw new Error('Tempo limite excedido ao aguardar a renderização do vídeo no D-ID.');
  }
}

export const didService = new DidService();
