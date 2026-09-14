---
title: "RADAR-TASYTRADE — Resumo da Correção de Dados Reais"
subtitle: "Resolvido vs. pendente — rodada de 2026-09-08 (achado BAC → \"só dados reais\")"
author: "Preparado para Duda"
date: "08 de setembro de 2026"
---

# Resolvido nesta rodada

| Item | Antes | Depois | Como foi verificado |
|---|---|---|---|
| Strike de opções | Fórmula sintética (`step = spot>100?5:2.5`) — gerou $47,50 inexistente na BAC | Só usa strikes que existem na cadeia real (`getOptionChain`, testado ao vivo contra a Tastytrade) | `tsc` limpo, teste unitário garante que todo strike usado está na cadeia mockada |
| Vencimento (DTE) | Fixo em 30 ou 35 DTE | Vencimento real mais próximo do alvo, lido da cadeia (`daysToExpiration` real) | Teste de regressão específico do achado BAC (38 DTE real ≠ 35 fixo) |
| Preço da perna (prêmio) | BSM com multiplicador de IV arbitrário (`×1.08`, `×0.98`...) | Cotação real (bid/ask/mid) via `GET /market-data/by-type` | `tsc`/`eslint` limpos; se qualquer perna não tiver cotação real, a recomendação inteira vira indisponível (testado) |
| Delta / IV por contrato | Calculado por BSM, exibido como se fosse grego real | Real via streaming DXLink (cliente novo, portado do seu dashboard Python comprovadamente funcional); `null` + rótulo "indisponível" quando o streaming não responde | Protocolo idêntico ao dashboard de referência (SETUP→AUTH→FEED); não testável ao vivo daqui (ver pendências) |
| Gráfico "Volatility Smile & Skew" | 100% fórmula sintética (`skewFactor` arbitrário) — achado só encontrado nesta reescrita | Só desenha com IV real por strike (mesmo streaming DXLink); mostra aviso quando indisponível | `tsc`/`eslint` limpos |
| Fabricação duplicada em `ai-consultant.ts` | `currentRatio: 1.45`, `ebitdaMargin: 0.28`, `priceToBook` estimado | `null` nos três campos (mesma correção já feita em outro arquivo) | `tsc`/`eslint` limpos |
| Checklist fixo da tela de Cotação | "SPOT: REAL", "NET GEX POSITIVO" (sempre positivo!), "FED 4.50%" fixos | Spot rotulado como catálogo (não é live nessa tela); GEX reflete a recomendação real; taxa Fed removida (nunca teve fonte) | `tsc`/`eslint` limpos |
| Fundamentos de tickers US (Frente 2) | Bloqueada "até achar vendor" | Fechada como `null` permanente — Tastytrade não tem esse dado e você vetou qualquer fonte fora dela | Decisão sua, registrada |
| Suíte de testes do motor | Testava função síncrona já obsoleta | Reescrita: 12 testes cobrindo classificação de regime, seleção de strike/vencimento real e a regra "sem cotação real = sem recomendação" | 12/12 passando |
| Suíte completa do projeto | — | 42/43 passando | 1 falha é o mesmo teste de rede que já falhava antes (sem internet neste shell) — não é regressão |

# Pendente — precisa da sua ação ou decisão

| Item | O que falta | Por que não fechei sozinho |
|---|---|---|
| Teste de ponta a ponta | Rodar `npm run dev` no seu terminal e abrir a tela de Opções/Análise de Volatilidade para um ticker real (ex.: BAC de novo) | O shell desta ponte não tem saída de rede geral — nunca consegui validar a integração fora daqui, só por partes isoladas |
| Limite de tempo da Vercel | Confirmar seu plano de deploy (Hobby = 10s por função; o streaming DXLink pode levar ~10s sozinho, antes de REST e auth) | Não tenho acesso ao painel da Vercel; se estourar, a rota falha em produção mesmo funcionando local |
| Bug pré-existente na árvore de estratégias | Estratégias 7 ("Trava de Baixa com Call a Crédito") e 22 ("Jade Lizard") caem no mesmo template genérico de trava de débito e não correspondem ao próprio nome | Não estava no escopo de "dados reais" — é arquitetura de estratégia, decisão separada sua |
| `provenance.ts` (badges MEDIDO/DERIVADO/ESTIMADO/SIMULADO) | Continua sem uso na UI, apesar de agora fazer sentido de verdade (dado real e indisponível convivem na mesma tela) | Fora do escopo desta leva; candidato natural para a próxima |
| GEX de `UnifiedGexBarreirasView.tsx` | Continua rotulado "MODELO CALIBRADO" — GEX calculado sobre inputs ainda não 100% ligados à cadeia real ponta a ponta | Não tocado nesta rodada; a Frente 1 corrigiu o motor de recomendação de estratégia, não (ainda) a camada de GEX visual |
| Verificação cega independente | Nova auditoria em sessão nova, sem meu contexto | Só faz sentido depois do teste de ponta a ponta confirmar que a integração funciona na prática |

O que não deve acontecer: eu (ou qualquer sessão futura) declarar isso "pronto" sem você ter visto os números baterem com a Tastytrade de novo, do jeito que viu com a BAC.
