---
name: auditoria-sistema-existente-dado-fabricado
description: Auditoria de sistema já construído contra dado fabricado/mal rotulado. Companheira da skill anti-fabricacao-de-dados (sistema novo). Use quando o sistema existe sem cerca de proveniência e a pergunta é "o que aqui é dado real e o que é fabricado?". Inventário, classificação pelo código real, priorização por risco de decisão, cerca retroativa, verificação independente e critério de fechamento.
---

# Auditoria de Sistema Existente Contra Dado Fabricado

Companheira da skill `anti-fabricacao-de-dados` (sistema NOVO, contrato antes do código). Esta é para o caso oposto: sistema já construído, sem a cerca, e a pergunta é "o que aqui é dado real e o que é fabricado/mal rotulado?". É engenharia reversa, mais cara que a versão preventiva, mas segue uma sequência que reduz o custo em relação a caçar achados sem método.

## Etapa 1 — Inventário antes de corrigir qualquer coisa
Leia o sistema inteiro (tela por tela, endpoint por endpoint) e catalogue TODO número exibido ao usuário antes de corrigir o primeiro. Não corrija o que encontrar no caminho: documente e continue. Corrigir achados isolados sem inventário completo garante voltar ao mesmo arquivo meses depois e achar mais coisa (aconteceu várias vezes: um arquivo "fechado" revelou 2-3 achados novos só por ser relido). O inventário não precisa ser perfeito na primeira passada, mas precisa existir como lista escrita antes de qualquer correção.

## Etapa 2 — Classificar cada item contra a taxonomia de 5 níveis
MEDIDO / DERIVADO / ESTIMADO / SIMULADO / INDISPONIVEL (definições e regra de contágio na skill `anti-fabricacao-de-dados`). Para cada item, leia o CÓDIGO REAL que produz o valor — nunca aceite o nome do campo ou o rótulo já existente na tela como evidência. Um badge "Fonte: Tastytrade Live" ao lado de um número não prova que ele vem de lá; só rastrear a variável até a chamada de API (ou até o catálogo estático, ou o literal hardcoded) prova. Rastreie também as guardas de estado (somente leitura): um campo só é MEDIDO de verdade se o bloco que o renderiza está atrás de uma condição de fetch-com-sucesso; se renderiza sempre, a classificação real pode ser pior que a alegada.

Atenção a valores que atravessam arquivo: uma função no componente A pode gerar/formatar um número renderizado no componente B (ex.: função auxiliar exportada de um gráfico, consumida por uma tela de detalhe). Confirme onde CADA campo do objeto de retorno é efetivamente renderizado, não só onde é calculado.

## Etapa 3 — Priorizar por risco de decisão, não por tamanho de arquivo
Ordene os achados por quanto uma pessoa real provavelmente confiaria naquele número para decidir algo (comprar, vender, alocar, agir), não pela quantidade de linhas. Um valor pequeno e discreto que parece autoritativo (ex.: selo "5/5" ao lado do nome do ativo) pode importar mais que um bloco grande já marcado como simulado com aviso visível.

## Etapa 4 — Construir a cerca estrutural retroativamente, antes de migrar a primeira tela
Mesmo em retrofit, não corrija achado por achado sem antes montar a peça estrutural (componente obrigatório + regra de lint) descrita na skill `anti-fabricacao-de-dados`. Migrar tela por tela sem ela reescreve a mesma decisão de UI em cada tela e deixa novas telas vulneráveis. Ordem: peça estrutural primeiro (1-2 rodadas), depois migração tela por tela dentro dela.

Espere que a regra de lint precise de mais de um reforço. Seletor baseado em padrão de texto (ex.: proibir uma função de formatação) sempre tem uma forma de escapar (valor guardado em variável antes de renderizar; depois, número nunca formatado e interpolado cru). Isso é esperado, não falha do processo. Prefira fechar a CLASSE do problema (regra com informação de tipo) a caçar a próxima instância manualmente.

## Etapa 5 — Verificação independente, nunca confiar em relatório agregado
Quando outra pessoa (ou outra sessão de IA) implementa a correção: não aceite "todos os testes passaram" como prova. Peça o hash do commit e o diff, e leia o diff. Rode suite de testes e lint você mesmo, se tiver acesso ao ambiente. Um script de gate que imprime "TUDO PASSOU" é sinal de que algo mudou, mas nunca substitui ler o diff: ele só verifica regras que JÁ EXISTEM; um achado novo, por definição, ainda não tem regra.

Disciplina de commit: um achado = uma correção = um teste de regressão, nunca agrupados. O arquivo de teste de auditoria pertence a quem audita; quem implementa nunca o edita, só o código de produção que precisa passar nele.

## Etapa 6 — Definir o critério de fechamento ANTES de começar
Auditoria sem critério de "pronto" parece infinita, porque "não achei mais nada" nunca é verificável. Defina um critério mensurável e binário, ex.: "débito de lint da regra estrutural chega a zero E toda a suite passa E o código commitado compila sozinho". Atingido o critério, qualquer achado novo é bug normal de manutenção, não prova de que a auditoria falhou. Itens fora do escopo mecânico (revisão de tom/linguagem, verificação de fontes externas específicas) vão para uma lista fechada à parte, com itens nomeados, nunca "vou continuar olhando".
