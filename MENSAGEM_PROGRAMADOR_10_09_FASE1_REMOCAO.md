# Mensagem para o programador — Fase 1: remover fabricação, não construir dado real ainda

Um inventário completo das 7 telas do sistema (não mais achado por achado — varredura sistemática) encontrou 3 telas com fabricação pura ou rótulo "ao vivo"/"real" sobre dado estático, fora do escopo do que o Ciclo 5 já cobriu. Decisão do usuário: **remover essas partes agora, não construir a versão real ainda** (isso fica para depois, como projeto dimensionado à parte).

Escrevi 5 testes novos em `tests/audit-gate.test.ts` (commit `211c63e`, já no repositório: `FASE1-01` a `FASE1-05`) travando exatamente essas remoções. Rode `npx vitest run tests/audit-gate.test.ts` — eles aparecem vermelhos agora, um por item abaixo.

**Regra de ouro de sempre: você nunca edita `tests/audit-gate.test.ts`.** Se achar que algum destes 5 testes está errado ou pede demais, pare e explique — não reescreva.

## FASE1-01 — Remover a aba "Panorama Geral" inteira

Ela é 100% fabricada: o "Termômetro de Sentimento" (score 58/100), a decomposição em 5 pilares, e os 4 mini-cards de macro (S&P futuros, petróleo, DXY, GEX) são todos números literais escritos direto no JSX — nenhuma variável, nenhuma chamada de API, nenhum catálogo por trás.

O que fazer:
- `src/components/layout/Navbar.tsx`: remova a entrada `{ id: 'panorama', label: 'Panorama Geral', ... }` de `navItems`, e remova `'panorama'` do tipo `ActiveTab`.
- `src/app/page.tsx`: remova o `import { PanoramaView }`, remova o bloco `<div id="panel-panorama">...</div>`, e troque o valor inicial de `useState<ActiveTab>('panorama')` para `'consulta'` (a aba Consulta & Gráfico já passou pelo Ciclo 5 e tem proveniência honesta — faz mais sentido como landing page que uma aba vazia).
- Apague o arquivo `src/components/panorama/PanoramaView.tsx`. Não deixe como código morto desreferenciado — isso é exatamente o padrão que auditorias anteriores já cobraram.

## FASE1-02 — Remover a tarja de VIX/SKEW/GEX hardcoded na Analista de Volatilidade

No topo de `VolatilityAnalystView.tsx`: "VIX Spot: 15.42 (CONTANGO)", "VIX9D/VIX3M: 0.86", "CBOE SKEW: 138.2", "SPX Net GEX: +$3.82 B" — mesma coisa, literal fixo, sem fonte. Remova o bloco inteiro.

## FASE1-03 — Remover o badge "Fonte: Tastytrade Live" colado ao Spot (mesma tela)

Esse badge testa `liveMetricsMap[...]?.source`, um campo que descreve se IV/GEX vieram ao vivo — não tem relação com o Spot ao lado, que vem do catálogo estático (`SP500_DATASET`) e nunca é atualizado pelo merge com dado ao vivo (`selectedAsset` não sobrescreve `spot`/`change`). Só remova o badge nesta rodada — não precisa construir um badge "ESTIMADO" novo nem buscar spot real agora, isso é decisão de escopo maior pra depois.

## FASE1-04 — ScreenerView: tirar a linguagem de continuidade/dado real, e o botão "Atualizar" falso

- `US_STOCKS_DATASET` é estático, mas a tela diz "Escaneamento contínuo das ações do S&P 500..." — reescreva para algo honesto (ex.: "Lista de ativos do catálogo S&P 500").
- O critério da categoria LATERAL diz "IV ATM Real Favorável" — `item.ivRank` vem do catálogo estático, não é "Real". Tire a palavra.
- O botão "Atualizar" (`handleRefresh`) só gira o ícone por 400ms via `setTimeout` — não rebusca nada, é puramente decorativo. Remova o handler falso e o spinner, ou o botão inteiro, até existir uma rebusca de verdade pra conectar nele.

## FASE1-05 — Corrigir o texto do Manual & Ajuda sobre GEX

`HelpSupportView.tsx` descreve o sistema como tendo "Estrutura de Mercado & Gamma Exposure (GEX) em tempo real via Tastytrade" — isso contradiz o próprio tooltip honesto que já existe no motor GEX (`UnifiedGexBarreirasView.tsx`: "modelo paramétrico interno... não representa posicionamento real de mercado"). Reescreva a frase pra refletir o que o motor realmente faz (ex.: "Estrutura de Mercado & Gamma Exposure (GEX) via modelo calibrado interno, com IV/gregas reais da Tastytrade quando disponíveis").

## Fora de escopo desta rodada (não mexer)

- `BarreirasGexView.tsx`/`UnifiedGexBarreirasView.tsx`: a grade de GEX já é honesta (tooltip explícito). O spot que a alimenta vem do mesmo catálogo estático, sem badge — mas como não há nenhuma alegação falsa ali, isso fica para uma decisão de Fase 2 (adicionar proveniência), não para esta rodada de remoção.
- `QuoteView.tsx`: já testado pelo gate do Ciclo 5, nenhuma mudança pedida aqui.
- `TASTYTRADE_EXPIRATIONS` (datas de vencimento em `UnifiedGexBarreirasView.tsx`) e as rotas `/api/market/metrics` e `/api/market/fundamentals` (`brapiService`): ainda não verificados a fundo, não fazem parte desta rodada.

## Ao terminar

1. Rode `rodar_audit_gate.bat` (ou `npx vitest run tests/audit-gate.test.ts` + `npx tsc --noEmit`) e confirme que `FASE1-01` a `FASE1-05` passaram, nenhum teste que estava verde ficou vermelho, e o typecheck do commitado deu zero erro.
2. Um commit por item (FASE1-01 a FASE1-05), sem agrupar — mesma disciplina de sempre.
3. Devolva a saída completa do `.bat` + hash de cada commit. Não declare a rodada "concluída" — quem decide é a auditoria, com o diff de cada commit.
