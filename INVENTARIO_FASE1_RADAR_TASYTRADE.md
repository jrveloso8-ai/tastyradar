---
title: "Inventario Fase 1 - Confiabilidade de Dado por Tela"
subtitle: "RADAR-TASYTRADE - classificacao de cada numero/rotulo exibido, com arquivo:linha"
author: "Auditoria Senior de Sistemas - Duda"
date: "10/09/2026"
---

# Metodo

Para cada tela do sistema, listo todo numero/rotulo relevante que a interface mostra e classifico em 4 categorias, verificadas por leitura direta do codigo-fonte (nao por inferencia):

- **(a) AO VIVO E CORRETO** - vem de uma chamada real a uma API/servico externo, sem fallback fabricado.
- **(b) ESTATICO, ROTULADO HONESTAMENTE** - vem de catalogo fixo, mas a tela avisa que e assim (marca-dagua de data, badge "ESTIMADO", tooltip explicito).
- **(c) ESTATICO, ROTULADO COMO SE FOSSE AO VIVO** - mesmo caso acima, mas a tela afirma ou insinua "ao vivo", "real", "continuo" sem isso ser verdade.
- **(d) FABRICACAO PURA** - numero literal escrito no codigo, sem nenhuma fonte de dado por tras (nem catalogo), apresentado como se fosse analitico.

(c) e (d) sao os achados que interessam. (a) e (b) sao o que o sistema deveria ser em toda tela.

# 1. Panorama Geral (`src/components/panorama/PanoramaView.tsx`, 244 linhas)

**Classificacao: (d) — fabricacao pura, tela inteira.** E a primeira tela que o usuario ve.

| Elemento na tela | Linha | O que e no codigo |
|---|---|---|
| "Termometro de Sentimento & Apetite a Risco": 58/100, "MODERADAMENTE OTIMISTA" | 108 (`const score = 58`), 108-109 | Constante literal, nunca recalculada |
| Decomposicao 5 pilares (Bolsas Globais +15pts, Commodities +12pts, Cambio DXY +10pts, Treasury/FOMC -12pts, GEX Tastytrade +13pts) | 155-198 | Texto estatico no JSX, nenhum calculo, nenhuma variavel |
| "Ultima consolidacao: Hoje as 08h45" | 129 | String literal "Hoje" — nao calcula data real |
| Futuros S&P 500 +0.82% (6.000 pts) | 202-206 | Literal |
| Petroleo Brent/WTI US$ 78.40/barril | 208-212 | Literal |
| Dolar/DXY 103.8, US10Y 4.42% | 214-218 | Literal |
| Net GEX/Fluxo Institucional +$2.85 Bi | 220-224 | Literal |

Texto de abertura da tela ("Score consolidado ponderando Bolsas Globais, Commodities, Cambio DXY, Curva de Juros Treasury/FOMC e Fluxo Institucional de GEX da Tastytrade") descreve um sistema de calculo que nao existe no codigo.

# 2. Rastreador de Tendencias / Screener (`src/components/screener/ScreenerView.tsx`, 275 linhas)

**Classificacao: (c).** Nao fabrica do zero (usa catalogo real `US_STOCKS_DATASET`), mas rotula como continuo/ao vivo o que e estatico, e nao mostra a marca-dagua de frescor que o catalogo ja tem disponivel (`dataAsOf`, do achado C5-01).

| Elemento | Linha | Fonte real | Problema |
|---|---|---|---|
| `item.spot`, `item.change` (3 colunas ALTA/BAIXA/LATERAL) | 170, 216, 261 | `US_STOCKS_DATASET` direto, sem merge com `liveMetricsMap` | Rotulo da tela diz "Escaneamento continuo" (linha 69) — e um snapshot fixo |
| `item.stop`, `item.alvo1`, `item.rr` | 175-177 | Mesmo catalogo estatico | Estes sao parametros de trade (stop/alvo) apresentados como acionaveis, congelados na data do catalogo |
| Botao "Atualizar" | 94-100, `handleRefresh` linha 51-54 | `setTimeout(400ms)` com spinner falso | Nao rebusca nada — e teatro de UI |
| "IV ATM Real Favoravel" (criterio LATERAL) | 240 | `item.ivRank` do catalogo estatico | Usa a palavra "Real" para um numero que nao e |
| `dataAsOf`/marca-dagua do catalogo | — | Existe em `us-market-data.ts` (achado C5-01) | Nunca exibida nesta tela |

# 3. Barreiras & Motor GEX (`BarreirasGexView.tsx` + `UnifiedGexBarreirasView.tsx`, 1018 linhas)

**Classificacao: (b) para a grade GEX em si, (c) para o spot que a alimenta.**

| Elemento | Linha | Fonte real | Avaliacao |
|---|---|---|---|
| Grade de OI/gamma/IV por strike | tooltip linha 318 | `calculateGex(..., 'calibrated-model')` — modelo parametrico interno | Honesto: tooltip explicito diz "nao representa posicionamento real de mercado" |
| `currentStock.spot` que alimenta a grade | `BarreirasGexView.tsx` linha 24-32 | `US_STOCKS_DATASET` direto | Mesmo catalogo estatico do achado do NVDA (142,50) — sem badge nesta tela |
| Ticker desconhecido (fora do catalogo) | linha 30 | `spot: 150.00` hardcoded | Fabricacao pura para qualquer simbolo fora da lista |
| "Grade de Vencimentos Oficiais Tastytrade" | linha 365-373 | `TASTYTRADE_EXPIRATIONS` (constante fixa de datas) | Rotulo "Oficiais" e justo se as datas realmente vierem do calendario real da Tastytrade — nao verificado nesta rodada, listar para Fase 2 |

# 4. Analista de Volatilidade (`VolatilityAnalystView.tsx`, 1489 linhas)

**Classificacao mista — o achado que abriu esta investigacao.**

| Elemento | Linha | Fonte real | Categoria |
|---|---|---|---|
| IV Rank/IV Percentil/IV30/liquidez/dias-ate-earnings/dividendo/HV | 148-165 (merge `liveMetricsMap`) | Real, via `/api/market/option-recommendation` quando disponivel | (a) quando `source === 'tastytrade-live'` |
| `selectedAsset.spot` | 148-165 (nao esta na lista de campos sobrescritos) | `SP500_DATASET` estatico — nunca atualizado pelo merge | **(c)** |
| Badge "Fonte: Tastytrade Live" ao lado do Spot | 1097-1103 | Testa `liveMetricsMap[...]?.source`, campo que nao tem relacao com spot | **(c)** — o achado original desta investigacao |
| Badge "AO VIVO (TASTYTRADE: symbol)" | 291-294 | Mesmo campo `source` | Correto quando aplicado as metricas de IV/GEX (que sao reais); mal posicionado onde aparece perto do spot |
| VIX Spot: 15.42 (CONTANGO) | 324-326 | Literal, sem variavel | **(d)** |
| VIX9D/VIX3M: 0.86 (Calmo) | 329-331 | Literal | **(d)** |
| CBOE SKEW: 138.2 (Tail Risk) | 334-336 | Literal | **(d)** |
| SPX Net GEX: +$3.82 B (+GEX Amortecido) | 339-341 | Literal | **(d)** |
| dataAsOf do catalogo | — | Existe em `sp500-dataset.ts` | Nunca exibida nesta tela |

# 5. Consulta & Grafico 12M (`QuoteView.tsx`, 1374 linhas)

**Classificacao: (b), na maior parte — e a tela mais trabalhada desta auditoria (achados C5-01 a C5-08 do laudo Ciclo 5, todos fechados e verificados por teste).**

| Elemento | Linha | Avaliacao |
|---|---|---|
| Spot/Variacao | 400-411 | Badge `ProvenanceTag="ESTIMADO"` explicito — honesto |
| Regime GEX / Opcoes eleita | 419, 840-870 | Badge de proveniencia combinada (`combineProvenance`), estados explicitos de loading/unavailable/ready |
| Fundamentos (currentRatio/ebitdaMargin/priceToBook) | ~140 | `null` quando fonte nao tem o dado (achado C5-04, fechado) |
| Aviso de ticker fora de cobertura | 338-352 | Banner explicito quando o ativo nao esta no catalogo de opcoes |

Nenhum achado novo grave aqui alem do que ja esta fechado — mas nao re-testei linha a linha, so os pontos que o gate ja cobre.

# 6. Manual & Ajuda IA (`HelpSupportView.tsx`, 401 linhas)

**Classificacao: (c) — nao e dado, e alegacao de capacidade que o codigo nao sustenta.**

| Elemento | Linha | Problema |
|---|---|---|
| "Estrutura de Mercado & Gamma Exposure (GEX) em tempo real via Tastytrade" | 100 | Contradiz o proprio tooltip honesto do motor GEX (`UnifiedGexBarreirasView.tsx` linha 318: "modelo parametrico interno... nao representa posicionamento real de mercado") |

# 7. Rotas de API (`src/app/api/market/*`, `src/app/api/health`)

Verificacao superficial (nao e o foco desta fase — sao a camada que ja recebeu correcoes de seguranca recentes):

| Rota | Observacao |
|---|---|
| `/api/market/option-recommendation` | Real — cadeia, cotacao e gregas via Tastytrade/DXLink, retorna `available:false` honesto quando nao confirma dado (ja verificado em rodada anterior) |
| `/api/health` | Real — checagem de autenticacao Tastytrade via REST (ja verificado) |
| `/api/market/metrics` | Usa `tastyMarketService` — nao inspecionei o corpo da resposta nesta rodada, listar para Fase 2 |
| `/api/market/fundamentals` | Usa `brapiService` + `fundamentalsEngine` — nao inspecionei se `brapiService` busca dado real ou tem fallback fabricado, listar para Fase 2 |
| `/api/market/ai-consultant` | Rate-limit e guarda de origem confirmados; qualidade do conteudo gerado pelo `aiConsultantEngine` nao avaliada nesta rodada |

# Resumo por tela

| Tela | Classificacao dominante | Gravidade |
|---|---|---|
| Panorama Geral | (d) fabricacao pura, tela inteira | **Critica** — primeira tela, zero dado real |
| Analista de Volatilidade | (c) spot + (d) tarja macro, mas IV/GEX real | **Alta** — mistura dado real com falso no mesmo cartao |
| Rastreador/Screener | (c) rotulo de continuidade falso | **Alta** — inclui stop/alvo de trade, nao so cotacao |
| Barreiras & Motor GEX | (b) grade honesta, (c) spot sem badge | Media |
| Manual & Ajuda IA | (c) alegacao incorreta de capacidade | Media (afeta confianca, nao decisao direta) |
| Consulta & Grafico 12M | (b) majoritariamente honesto, ja testado pelo gate | Baixa |
| Rotas de API core | Maioria (a), 2 itens nao inspecionados | Baixa/Pendente verificacao |

# O que fica pendente para a Fase 2 (nao decidido aqui, decisao e sua)

1. Panorama Geral: reconstruir com dado real (VIX/SKEW/macro via API) ou rotular como protótipo/remover, para cada um dos 5 pilares e 4 mini-cards.
2. Screener: aplicar o mesmo merge com `liveMetricsMap` que a Volatilidade ja tem, ou pelo menos expor `dataAsOf` e trocar a linguagem de "continuo"/"Real" por honesta.
3. Volatilidade: separar o badge do spot do badge de IV/GEX (spot deveria mostrar `dataAsOf`, nao "Tastytrade Live"); decidir se vale buscar spot real via REST (endpoint ainda nao existe no projeto).
4. Barreiras & GEX: badge de proveniencia no spot desta tela tambem; verificar se `TASTYTRADE_EXPIRATIONS` de fato bate com o calendario real.
5. Manual & Ajuda: corrigir o texto que descreve GEX como "tempo real" quando e modelo calibrado.
6. Verificar `brapiService` (rota de fundamentos) e o corpo de resposta de `/api/market/metrics` — nao inspecionados nesta fase.
