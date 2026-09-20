import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  processDxlinkCandleData,
  DxlinkRawCandleItem,
  DxlinkCandleCollectorService,
  TASTYTRADE_DXLINK_CANDLE_SOURCE,
  CALENDAR_DAYS_BUFFER_FOR_252_TRADING_DAYS,
} from './dxlink-candle-collector.service';
import { tastyAuthService } from './tastytrade-auth.service';
import WebSocket from 'ws';

// Mocks estritos: nenhuma conexão real com a Tastytrade é disparada nos testes
vi.mock('ws');
vi.mock('./tastytrade-auth.service');

describe('Módulo Dedicado de Captura de Candles DXLink — Lógica Pura & Robustez', () => {
  const baseTime = new Date('2025-01-01T00:00:00.000Z').getTime();
  const dayMs = 24 * 60 * 60 * 1000;

  // Helper para gerar itens brutos simulando o evento Candle do DXLink
  function generateRawDxlinkBars(
    symbol: string,
    count: number,
    mutator?: (index: number) => Partial<DxlinkRawCandleItem>
  ): DxlinkRawCandleItem[] {
    const items: DxlinkRawCandleItem[] = [];
    for (let i = 0; i < count; i++) {
      const itemTime = baseTime + i * dayMs;
      const baseItem: DxlinkRawCandleItem = {
        eventType: 'Candle',
        eventSymbol: `${symbol}{=d}`,
        time: itemTime,
        open: 100 + (i % 10),
        high: 105 + (i % 10),
        low: 95 + (i % 10),
        close: 102 + (i % 10),
        volume: 50000 + i * 100,
        count: 50000 + i * 100,
      };

      if (mutator) {
        Object.assign(baseItem, mutator(i));
      }

      items.push(baseItem);
    }
    return items;
  }

  describe('Constantes de Negócio e Parametrização', () => {
    it('deve exportar CALENDAR_DAYS_BUFFER_FOR_252_TRADING_DAYS como 370 dias corridos documentados', () => {
      expect(CALENDAR_DAYS_BUFFER_FOR_252_TRADING_DAYS).toBe(370);
    });

    it('deve usar TASTYTRADE_DXLINK_CANDLE_SOURCE alinhado como "tastytrade-dxlink-candles"', () => {
      expect(TASTYTRADE_DXLINK_CANDLE_SOURCE).toBe('tastytrade-dxlink-candles');
    });
  });

  describe('processDxlinkCandleData (Função Pura)', () => {
    it('deve processar, deduplicar e ordenar cronologicamente quando o lote for completo (>= 250 barras)', () => {
      const raw = generateRawDxlinkBars('AAPL', 255);
      // Injeta duplicata com timestamp igual para testar deduplicação
      raw.push({
        eventType: 'Candle',
        eventSymbol: 'AAPL{=d}',
        time: baseTime,
        open: 100,
        high: 105,
        low: 95,
        close: 102,
        volume: 50000,
      });

      const result = processDxlinkCandleData('AAPL', raw, { minBarsRequired: 250 });

      expect(result.isComplete).toBe(true);
      expect(result.symbol).toBe('AAPL');
      expect(result.provenance).toBe('MEDIDO');
      expect(result.source).toBe(TASTYTRADE_DXLINK_CANDLE_SOURCE);
      expect(result.bars.length).toBe(255);
      expect(result.rejectionCode).toBeUndefined();

      // Confere ordenação cronológica estrita
      for (let i = 1; i < result.bars.length; i++) {
        expect(result.bars[i].date > result.bars[i - 1].date).toBe(true);
      }
    });

    it('REGRA 00: deve rejeitar com CANDLE_STREAM_INCOMPLETE e proveniência INDISPONIVEL se vierem menos de 250 barras', () => {
      const raw = generateRawDxlinkBars('MSFT', 249); // 249 barras (1 a menos que o mínimo)

      const result = processDxlinkCandleData('MSFT', raw, { minBarsRequired: 250 });

      expect(result.isComplete).toBe(false);
      expect(result.rejectionCode).toBe('CANDLE_STREAM_INCOMPLETE');
      expect(result.provenance).toBe('INDISPONIVEL');
      expect(result.source).toBe(TASTYTRADE_DXLINK_CANDLE_SOURCE);
      expect(result.rejectionReason).toContain('recebidas 249 barras, mínimo exigido é 250');
      // Não inventa barras de preenchimento
      expect(result.bars.length).toBe(249);
    });

    it('REGRA 00: deve rejeitar com INVALID_BAR_DATA quando houver violação física (high < low)', () => {
      const raw = generateRawDxlinkBars('NVDA', 255, (i) => {
        if (i === 10) {
          return { high: 90, low: 95 }; // high menor que low
        }
        return {};
      });

      const result = processDxlinkCandleData('NVDA', raw, { minBarsRequired: 250 });

      expect(result.isComplete).toBe(false);
      expect(result.rejectionCode).toBe('INVALID_BAR_DATA');
      expect(result.provenance).toBe('INDISPONIVEL');
      expect(result.source).toBe(TASTYTRADE_DXLINK_CANDLE_SOURCE);
      expect(result.bars.length).toBe(0);
      expect(result.rejectionReason).toContain('high: 90 < low: 95');
    });

    it('REGRA 00: deve rejeitar com INVALID_BAR_DATA quando houver preço menor ou igual a zero', () => {
      const rawZero = generateRawDxlinkBars('JPM', 255, (i) => {
        if (i === 12) {
          return { close: 0 }; // Preço zero é proibido
        }
        return {};
      });

      const resZero = processDxlinkCandleData('JPM', rawZero, { minBarsRequired: 250 });
      expect(resZero.isComplete).toBe(false);
      expect(resZero.rejectionCode).toBe('INVALID_BAR_DATA');
      expect(resZero.provenance).toBe('INDISPONIVEL');
      expect(resZero.rejectionReason).toContain('Preço não positivo detectado na barra');

      const rawNeg = generateRawDxlinkBars('JPM', 255, (i) => {
        if (i === 15) {
          return { low: -10 }; // Preço negativo é proibido
        }
        return {};
      });

      const resNeg = processDxlinkCandleData('JPM', rawNeg, { minBarsRequired: 250 });
      expect(resNeg.isComplete).toBe(false);
      expect(resNeg.rejectionCode).toBe('INVALID_BAR_DATA');
    });

    it('REGRA 00: deve rejeitar com INVALID_BAR_DATA quando algum preço for NaN', () => {
      const raw = generateRawDxlinkBars('TSLA', 255, (i) => {
        if (i === 5) {
          return { close: NaN };
        }
        return {};
      });

      const result = processDxlinkCandleData('TSLA', raw, { minBarsRequired: 250 });

      expect(result.isComplete).toBe(false);
      expect(result.rejectionCode).toBe('INVALID_BAR_DATA');
      expect(result.provenance).toBe('INDISPONIVEL');
      expect(result.bars.length).toBe(0);
    });

    it('deve permitir que uma correção tardia válida sobrescreva um item inválido transitório anterior da mesma data', () => {
      const raw = generateRawDxlinkBars('AAPL', 255);

      // Injeta um item inicial com high < low para o dia 10
      const targetTime = baseTime + 10 * dayMs;
      raw.splice(10, 0, {
        eventType: 'Candle',
        eventSymbol: 'AAPL{=d}',
        time: targetTime,
        open: 100,
        high: 80, // high inválido (< low)
        low: 90,
        close: 85,
        volume: 1000,
      });

      // O item definitivo válido para targetTime está presente mais adiante no stream
      // (a atualização mais recente no feed consolida a data)
      const result = processDxlinkCandleData('AAPL', raw, { minBarsRequired: 250 });

      expect(result.isComplete).toBe(true);
      expect(result.bars.length).toBe(255);
      expect(result.rejectionCode).toBeUndefined();
      expect(result.provenance).toBe('MEDIDO');

      // Confere que a barra consolidada do dia 10 é a versão válida
      const bar10 = result.bars.find((b) => b.date === new Date(targetTime).toISOString().split('T')[0]);
      expect(bar10).toBeDefined();
      expect(bar10!.high).toBeGreaterThanOrEqual(bar10!.low);
    });

    it('deve isolar símbolos e ignorar barras pertencentes a outros tickers no mesmo feed', () => {
      const rawAapl = generateRawDxlinkBars('AAPL', 255);
      const rawTsla = generateRawDxlinkBars('TSLA', 255);
      const mixed = [...rawAapl, ...rawTsla];

      const resAapl = processDxlinkCandleData('AAPL', mixed, { minBarsRequired: 250 });
      const resTsla = processDxlinkCandleData('TSLA', mixed, { minBarsRequired: 250 });

      expect(resAapl.isComplete).toBe(true);
      expect(resAapl.bars.length).toBe(255);

      expect(resTsla.isComplete).toBe(true);
      expect(resTsla.bars.length).toBe(255);
    });
  });

  describe('DxlinkCandleCollectorService — Gestão de Conexão e Timeout (Mock Completo)', () => {
    let mockWsInstance: any;

    beforeEach(() => {
      vi.clearAllMocks();

      mockWsInstance = {
        on: vi.fn(),
        send: vi.fn(),
        close: vi.fn(),
        removeAllListeners: vi.fn(),
      };

      (WebSocket as any).mockImplementation(() => mockWsInstance);
      vi.mocked(tastyAuthService.getStreamerToken).mockResolvedValue({
        token: 'mock-token',
        dxlinkUrl: 'wss://streamer.tastytrade.com',
      });
    });

    it('REGRA 00: deve falhar controladamente com CANDLE_STREAM_TIMEOUT se a conexão estourar o tempo limite', async () => {
      const service = new DxlinkCandleCollectorService();

      // Configura timeout bem curto (50ms) para o teste
      const promise = service.collectDailyCandles(['AAPL'], {
        timeoutMs: 50,
        minBarsRequired: 250,
      });

      const resultMap = await promise;
      const aaplRes = resultMap.get('AAPL');

      expect(aaplRes).toBeDefined();
      expect(aaplRes?.isComplete).toBe(false);
      expect(aaplRes?.rejectionCode).toBe('CANDLE_STREAM_TIMEOUT');
      expect(aaplRes?.provenance).toBe('INDISPONIVEL');
      expect(aaplRes?.rejectionReason).toContain('Timeout de 50ms atingido');
      expect(mockWsInstance.close).toHaveBeenCalled();
    });

    it('BLOQUEANTE RESOLVIDO: timeout NUNCA deve mascarar a causa raiz real quando houver dado corrompido (propaga INVALID_BAR_DATA)', async () => {
      const service = new DxlinkCandleCollectorService();

      // Mocka o WebSocket para entregar dados contendo uma barra corrompida (high < low)
      // e depois não enviar mais nada, forçando o timeout
      mockWsInstance.on.mockImplementation((event: string, callback: any) => {
        if (event === 'open') {
          callback();
        } else if (event === 'message') {
          // Handshake
          callback(JSON.stringify({ type: 'SETUP' }));
          callback(JSON.stringify({ type: 'AUTH_STATE', state: 'AUTHORIZED' }));
          callback(JSON.stringify({ type: 'CHANNEL_OPENED', channel: 1 }));

          // Envia lote parcial com 50 barras normais e 1 barra fisicamente corrompida
          const rawBars = generateRawDxlinkBars('AAPL', 50);
          rawBars.push({
            eventType: 'Candle',
            eventSymbol: 'AAPL{=d}',
            time: baseTime + 60 * dayMs,
            open: 100,
            high: 50, // Físicamente corrompido: high < low
            low: 90,
            close: 70,
            volume: 1000,
          });

          callback(JSON.stringify({
            type: 'FEED_DATA',
            channel: 1,
            data: rawBars,
          }));
        }
      });

      // Executa com timeout de 50ms para disparar o timeout em finishCollection(true)
      const resultMap = await service.collectDailyCandles(['AAPL'], {
        timeoutMs: 50,
        minBarsRequired: 250,
      });

      const aaplRes = resultMap.get('AAPL');

      expect(aaplRes).toBeDefined();
      expect(aaplRes?.isComplete).toBe(false);
      // Asserção Crítica: Mesmo com timeout ocorrendo, o rejectionCode final DEVE ser a causa raiz real (INVALID_BAR_DATA)
      expect(aaplRes?.rejectionCode).toBe('INVALID_BAR_DATA');
      expect(aaplRes?.provenance).toBe('INDISPONIVEL');
      expect(aaplRes?.rejectionReason).toContain('Inconsistência física nos preços da barra');
      expect(mockWsInstance.close).toHaveBeenCalled();
    });

    it('deve retornar API_FAILURE caso o serviço de autenticação do streamer falhe', async () => {
      vi.mocked(tastyAuthService.getStreamerToken).mockRejectedValueOnce(new Error('Auth Network Error'));

      const service = new DxlinkCandleCollectorService();
      const resultMap = await service.collectDailyCandles(['TSLA']);
      const tslaRes = resultMap.get('TSLA');

      expect(tslaRes?.isComplete).toBe(false);
      expect(tslaRes?.rejectionCode).toBe('API_FAILURE');
      expect(tslaRes?.rejectionReason).toContain('Falha de autenticação');
    });
  });
});
