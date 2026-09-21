import { tastyAuthService } from '../src/lib/services/tastytrade-auth.service';

async function testApi() {
  try {
    console.log('Refreshing token with forceRefresh=true...');
    const token = await tastyAuthService.getAccessToken(true);
    console.log('SUCCESS: Refreshed token! (Length:', token.length, ')');

    // 1. Test market metrics
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
      'User-Agent': 'RadarTastytrade/1.0',
    };
    const metricsRes = await fetch('https://api.tastytrade.com/market-metrics?symbols=AAPL,NVDA,JNJ,JPM,XOM,KO,TSLA', {
      headers,
    });
    console.log('market-metrics status:', metricsRes.status);
    const errText = await metricsRes.text();
    console.log('market-metrics response body:', errText);

    // 2. Test option chains
    const chainRes = await fetch('https://api.tastytrade.com/option-chains/AAPL/nested', {
      headers,
    });
    console.log('option-chains/AAPL/nested status:', chainRes.status);
    if (chainRes.ok) {
      const chainData = await chainRes.json();
      const underlying = chainData?.data?.items ? chainData.data.items[0] : chainData?.data;
      console.log('AAPL Expirations count:', underlying?.expirations?.length);
    }

    // 3. Test equity quotes
    const eqRes = await fetch('https://api.tastytrade.com/market-data/by-type?equity=AAPL,NVDA,JNJ,JPM,XOM', {
      headers,
    });
    console.log('market-data/by-type equity status:', eqRes.status);
    if (eqRes.ok) {
      const eqData = await eqRes.json();
      console.log('Equity quotes count:', eqData?.data?.items?.length);
    }

    // 4. Test candles endpoints with proper headers
    // 4. Test DXLink Candle streaming
    const streamer = await tastyAuthService.getStreamerToken();
    console.log('Got streamer token, url:', streamer.dxlinkUrl);

    const WebSocket = (await import('ws')).default;
    const ws = new WebSocket(streamer.dxlinkUrl);

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        ws.close();
        resolve();
      }, 10000);

      ws.on('open', () => {
        console.log('WS Open. Sending SETUP...');
        ws.send(JSON.stringify({ type: 'SETUP', channel: 0, keepaliveInterval: 30, acceptKeepaliveInterval: 30, version: '0.1-GFE-1.0.0' }));
      });

      ws.on('message', (raw) => {
        const msg = JSON.parse(raw.toString());
        console.log('WS Msg type:', msg.type, 'channel:', msg.channel, 'state:', msg.state);

        if (msg.type === 'SETUP') {
          console.log('Sending AUTH...');
          ws.send(JSON.stringify({ type: 'AUTH', channel: 0, token: streamer.token }));
        } else if (msg.type === 'AUTH_STATE' && msg.state === 'AUTHORIZED') {
          console.log('AUTHORIZED! Requesting channel FEED...');
          ws.send(JSON.stringify({ type: 'CHANNEL_REQUEST', channel: 1, service: 'FEED', parameters: { contract: 'AUTO' } }));
        } else if (msg.type === 'CHANNEL_OPENED' && msg.channel === 1) {
          console.log('Channel 1 opened! Setting subscription for Candle...');
          // Setup feed subscription for AAPL{=d}
          const oneYearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;
          ws.send(JSON.stringify({
            type: 'FEED_SUBSCRIPTION',
            channel: 1,
            add: [{ type: 'Candle', symbol: 'AAPL{=d}', fromTime: oneYearAgo }]
          }));
        } else if (msg.type === 'FEED_DATA') {
          console.log('RECEIVED FEED_DATA! Data keys / sample:', JSON.stringify(msg.data).slice(0, 200));
          clearTimeout(timeout);
          ws.close();
          resolve();
        }
      });

      ws.on('error', (err) => {
        console.error('WS Error:', err);
        clearTimeout(timeout);
        resolve();
      });
    });
  } catch (err: any) {
    console.error('Error in testApi:', err);
  }
}

testApi();
