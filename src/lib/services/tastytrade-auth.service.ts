import fs from 'fs';
import path from 'path';

interface TokenCache {
  access_token: string;
  expires_in: number;
  expires_at: number;
  fetched_at: number;
}

interface StreamerCache {
  token: string;
  dxlink_url: string;
  expires_in: number;
  expires_at: number;
  fetched_at: number;
}

export class TastytradeAuthService {
  private clientId: string;
  private clientSecret: string;
  private refreshToken: string;
  private baseUrl: string;
  private tokenFilePath: string;
  private streamerFilePath: string;

  constructor() {
    this.clientId = process.env.CLIENT_ID || '';
    this.clientSecret = process.env.CLIENT_SECRET || '';
    this.refreshToken = process.env.REFRESH_TOKEN || '';
    this.baseUrl = process.env.TASTYTRADE_ENV === 'cert' 
      ? 'https://api.cert.tastyworks.com' 
      : 'https://api.tastytrade.com';
    this.tokenFilePath = path.join(process.cwd(), 'tasty_token.json');
    this.streamerFilePath = path.join(process.cwd(), 'streamer_token.json');
  }

  public async getAccessToken(forceRefresh = false): Promise<string> {
    if (!forceRefresh && fs.existsSync(this.tokenFilePath)) {
      try {
        const raw = fs.readFileSync(this.tokenFilePath, 'utf8');
        const data: TokenCache = JSON.parse(raw);
        const now = Date.now() / 1000;
        if (data.expires_at > now + 60) {
          return data.access_token;
        }
      } catch {
        // Cache miss
      }
    }

    if (!this.clientId || !this.clientSecret || !this.refreshToken) {
      throw new Error('Credenciais da Tastytrade ausentes (.env.local: CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN)');
    }

    const res = await fetch('https://api.tastytrade.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'RadarTastytrade/1.0',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: this.refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Falha ao renovar token OAuth2 Tastytrade (HTTP ${res.status}): ${errText}`);
    }

    const body = await res.json();
    const accessToken = body.access_token;
    const expiresIn = body.expires_in || 900;
    const now = Date.now() / 1000;

    const cache: TokenCache = {
      access_token: accessToken,
      expires_in: expiresIn,
      expires_at: now + expiresIn,
      fetched_at: now,
    };

    try {
      fs.writeFileSync(this.tokenFilePath, JSON.stringify(cache, null, 2), 'utf8');
    } catch {}

    return accessToken;
  }

  public async getStreamerToken(forceRefresh = false): Promise<{ token: string; dxlinkUrl: string }> {
    if (!forceRefresh && fs.existsSync(this.streamerFilePath)) {
      try {
        const raw = fs.readFileSync(this.streamerFilePath, 'utf8');
        const data: StreamerCache = JSON.parse(raw);
        const now = Date.now() / 1000;
        if (data.expires_at > now + 300) {
          return { token: data.token, dxlinkUrl: data.dxlink_url };
        }
      } catch {}
    }

    const accessToken = await this.getAccessToken();
    const res = await fetch(`${this.baseUrl}/api-quote-tokens`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': 'RadarTastytrade/1.0',
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Falha ao obter streamer token (HTTP ${res.status}): ${errText}`);
    }

    const json = await res.json();
    const token = json.data?.token;
    const dxlinkUrl = json.data?.['dxlink-url'];

    if (!token || !dxlinkUrl) {
      throw new Error('Resposta de /api-quote-tokens não contém token ou dxlink-url');
    }

    const expiresIn = 20 * 3600;
    const now = Date.now() / 1000;
    const cache: StreamerCache = {
      token,
      dxlink_url: dxlinkUrl,
      expires_in: expiresIn,
      expires_at: now + expiresIn,
      fetched_at: now,
    };

    try {
      fs.writeFileSync(this.streamerFilePath, JSON.stringify(cache, null, 2), 'utf8');
    } catch {}

    return { token, dxlinkUrl };
  }
}

export const tastyAuthService = new TastytradeAuthService();