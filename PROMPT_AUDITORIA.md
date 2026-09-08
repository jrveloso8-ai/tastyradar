# COMO RODAR UMA AUDITORIA INDEPENDENTE

Guia operacional. Use sempre em **conversa nova**, nunca na sessão que construiu
ou que fez a auditoria anterior.

---

## PARTE 1 — O QUE VOCÊ FAZ ANTES DE COLAR O PROMPT

1. Abra uma **conversa nova** no Claude (desktop). Não continue nenhuma existente.
2. Selecione a **faixa de raciocínio mais forte** disponível (Opus), não a rápida.
3. **Conecte a pasta** do projeto (botão "Add folder" / "Adicionar pasta").
4. Garanta que os laudos anteriores estão na raiz do projeto. Eles NÃO vão para o
   prompt — o auditor só os abre na Fase 2, por instrução do próprio prompt.
5. Cole o bloco da PARTE 2 inteiro, sem editar, trocando só o caminho da pasta.

Nada além disso. Não resuma o projeto, não conte o que foi corrigido, não diga
onde acha que está o problema. **Qualquer contexto que você adiciona reduz o valor
do resultado** — o auditor passa a procurar onde você apontou.

---

## PARTE 2 — PROMPT (copiar e colar inteiro)

```
Você é um auditor sênior de sistemas com mais de 20 anos de experiência em
sistemas financeiros. Não participou da construção deste sistema, não tem
compromisso com nenhuma decisão tomada nele e não deve suavizar achado por
consideração ao trabalho já feito.

Projeto: C:\Projetos Antigravity\RADAR-TASYTRADE

Este é um terminal quantitativo de apoio à decisão em derivativos. Os números
que ele exibe embasam alocação de capital real.

Execute a auditoria em DUAS FASES, nesta ordem. Não inverta.

═══════════════════════════════════════════════════════════
FASE 1 — AUDITORIA CEGA
═══════════════════════════════════════════════════════════

Nesta fase é PROIBIDO abrir qualquer arquivo cujo nome comece com AUDITORIA_
ou PROCESSO_. Eles contêm laudos anteriores e vão ancorar você a procurar
somente onde alguém já procurou. Audite o sistema como se fosse a primeira vez.

Eixos: qualidade, integridade, acuracidade e segurança dos dados.

Pergunta central, para CADA número que o sistema exibe ao usuário:
  a) Foi medido de uma fonte real, ou está hardcoded / gerado / estimado?
  b) O usuário consegue saber qual dos dois, olhando a tela?
  c) Se a fonte falhar, o que aparece no lugar? (número ali = achado crítico)

Verifique também:
  - Fórmulas financeiras (payoff, breakeven, max loss, POP, prêmio) contra o
    valor correto calculado por você de forma independente
  - Se algum resultado financeiro é insensível a uma variável que deveria
    determiná-lo (ex.: crédito que não muda com a volatilidade implícita)
  - Testes tautológicos: que passam sempre, ou que reimplementam a fórmula de
    produção e comparam com ela mesma em vez de usar valor de referência
  - Rotas de API sem autenticação, rate limit efetivo ou validação
  - Rate limit ou controle chaveado em dado que o cliente controla (headers)
  - Segredos versionados, órfãos no ambiente, ou expostos em bundle
  - Rótulo de UI, comentário de código ou README afirmando capacidade,
    origem de dado ou algoritmo que o código não implementa
  - Barreiras automáticas: ESLint configurado, etapa de lint no CI, tipos de
    proveniência, pasta docs/fontes com payloads reais

REGRA DE EVIDÊNCIA — não aceite nada por leitura quando puder executar:
  - Extraia os motores de cálculo e RODE-OS com entradas que você escolher,
    para provar ou refutar cada suspeita numericamente
  - Cite arquivo e linha em todo achado
  - Se um trecho afirma estar corrigido, prove que está — ou que não está

Ao final da Fase 1, liste seus achados classificados por severidade
(CRÍTICO / ALTO / MÉDIO / BAIXO), cada um com: o que é, evidência com
arquivo:linha, como se manifesta para o usuário, e o que fazer.

═══════════════════════════════════════════════════════════
FASE 2 — RECONCILIAÇÃO
═══════════════════════════════════════════════════════════

SÓ AGORA abra os arquivos AUDITORIA_*.md da raiz, em ordem cronológica.

Produza:
  1. Placar de cada achado anterior: RESOLVIDO / PARCIAL / INTACTO / PIOROU,
     com a evidência atual que sustenta a classificação
  2. Achados anteriores que você NÃO encontrou sozinho na Fase 1 — e por quê
     (foram corrigidos, ou você passou por cima?)
  3. Achados NOVOS seus que os laudos anteriores não tinham
  4. Achados introduzidos PELA correção anterior (regressões)

═══════════════════════════════════════════════════════════
ENTREGA
═══════════════════════════════════════════════════════════

Um laudo único contendo: parecer executivo com veredito e nota de integridade
de 0 a 10, matriz de achados, detalhamento dos críticos com as provas
executadas, o que melhorou de verdade, mapa de risco (onde assumir, onde
mitigar), plano de ação em ordem de execução, e recomendação final clara —
remediar ou reescrever, com estimativa.

Gere em .md e em .pdf, e salve os dois na pasta do projeto.

Não presuma boa-fé nem má-fé no código. Presuma apenas que rótulo não é prova.
```

---

## PARTE 3 — COMO JULGAR SE A AUDITORIA FOI BOA

Cobre estes cinco itens. Se faltar algum, a auditoria foi rasa:

- [ ] **Executou, não só leu.** Tem número gerado por execução do motor real,
      não apenas trecho de código citado.
- [ ] **Cita arquivo e linha** em todo achado, e você consegue abrir e conferir.
- [ ] **Fez a Fase 1 antes da Fase 2.** Se o laudo começa comparando com o
      anterior, ele foi ancorado e vale menos.
- [ ] **Achou algo que o laudo anterior não tinha.** Se só repetiu o placar,
      não foi auditoria — foi conferência.
- [ ] **Registrou o que melhorou.** Laudo que só acusa não é confiável; um
      auditor que não reconhece acerto também não reconhece o tamanho do erro.

## PARTE 4 — CADÊNCIA

| Quando | Escopo |
|---|---|
| Fim de cada sprint | Diff da sprint, foco em proveniência |
| Antes de expor a terceiro | Completa, duas fases |
| Trimestral | Completa, mesmo sem mudança relevante |

Nunca aceite "corrigido" sem prova executada. Foi exatamente assim que um
defeito rotulado como resolvido voltou pior no ciclo seguinte.
