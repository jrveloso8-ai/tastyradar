---
name: anti-fabricacao-de-dados
description: Arquitetura Anti-Fabricação de Dados. Use ao construir ou auditar qualquer sistema que exiba números que parecem medidos mas podem vir de catálogo estático, modelo, proxy, fallback ou simulação, e cujo usuário tome decisões reais (ex.: financeiro/trading). Contrato de proveniência (MEDIDO/DERIVADO/ESTIMADO/SIMULADO/INDISPONIVEL), cerca estrutural (DataValue + lint), gate automático, revisão independente e testes de regressão por achado.
---

# Arquitetura Anti-Fabricação de Dados

Origem: lições de uma auditoria real (RADAR-TASYTRADE) onde dado fabricado/mal rotulado (hardcoded apresentado como real, badges de fonte que não correspondiam ao dado, níveis técnicos arbitrários rotulados como calculados) se acumulou porque nenhuma camada obrigava declarar de onde um número vinha.

## Quando se aplica
Qualquer sistema que exibe número que parece medido/real mas pode vir de: catálogo estático desatualizado, modelo paramétrico interno, proxy/estimativa, fallback quando a API falha, ou dado simulado. Se o usuário decide algo com base nele, aplica-se. Não se aplica a protótipo descartável.

## Etapa 0 — Nível de rigor
O sistema informa decisão real com consequência real se o dado estiver errado? Se sim, siga as etapas 1-5. Se não, pule.

## Etapa 1 — Contrato de proveniência, antes de qualquer tela
Documento curto listando cada categoria de dado exibido: de onde REALMENTE vem e qual classificação carrega.
- MEDIDO — direto de fonte real, sem transformação.
- DERIVADO — calculado a partir de MEDIDO por fórmula auditável.
- ESTIMADO — catálogo estático, proxy ou modelo que aproxima valor real.
- SIMULADO — inteiramente modelado/ilustrativo.
- INDISPONIVEL — fonte real tentada e falhou; nunca preencher com aproximação sem marcar.

Regra de contágio: valor que combina insumos de várias classificações herda a PIOR (SIMULADO contamina tudo; INDISPONIVEL contamina exceto se já houver SIMULADO). Implementar `combineProvenance` com suíte de testes própria. A classificação é decisão de quem entende a fonte, não do programador durante a implementação.

## Etapa 2 — Cerca estrutural de dia 1
- Componente único (ex.: `DataValue`) pelo qual TODO número exibido passa. Props obrigatórias em tipo: `provenance` e `source` (sem default, sem `?`). Ausência (null/undefined) é estado de primeira classe: renderiza "N/D", nunca omite nem mostra zero. Variante "inline" para muitos valores de mesma proveniência (mantém obrigação de tipo, sem repetir badge).
- Regra de lint que impeça número formatado (`.toFixed()` etc.) fora do componente. Seletores por texto têm brecha; a correção de classe é regra com informação de TIPO (@typescript-eslint com parserOptions.project) flagando expressão `number` em JSX fora do componente estrutural. Falso-positivos (índice, contador de UI) resolvem-se com eslint-disable justificado por escrito, nunca com mais regex.

## Etapa 3 — Gate automático
typecheck + lint + testes rodam sozinhos (pre-commit/CI) e bloqueiam merge. Incluir verificação de que o código COMMITADO compila sozinho (git stash + typecheck).

## Etapa 4 — Implementação dentro da cerca, revisão de julgamento por fora
Ferramentas resolvem o mecânico; não resolvem se a classificação DECLARADA é a CORRETA (algo rotulado MEDIDO vem mesmo de fonte ao vivo? o "modelo interno" citado é o usado?). Exige segundo revisor independente lendo o diff contra o código real, não contra o resumo do implementador.

## Etapa 5 — Todo achado vira teste de regressão
Um achado = um commit de correção = um teste; nunca agrupar achados. O arquivo de testes de auditoria pertence a quem audita, não a quem implementa.

## Por que a ordem importa
Gap pego no lint/compile custa segundos; na revisão humana, uma rodada; em produção, a confiança do usuário. Mesmo trabalho, na etapa mais barata.
