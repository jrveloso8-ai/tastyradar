/**
 * Portao de Auditoria (Audit Gate) — RADAR-TASYTRADE
 *
 * REGRA DE OURO, NAO NEGOCIAVEL:
 * Este arquivo so pode ser alterado pelo auditor (documentado como tal em commit
 * separado e explicado). Se voce e o "programador" corrigindo achados de auditoria,
 * NUNCA edite este arquivo para fazer um teste passar. Corrija o codigo de PRODUCAO
 * (QuoteView.tsx, ai-consultant.ts, gex-engine.ts, us-market-data.ts, sp500-dataset.ts,
 * README.md, .eslintrc.json etc). Um teste deste arquivo so pode ficar verde por
 * mudanca no codigo auditado — nunca por mudanca no proprio teste.
 *
 * Cada teste abaixo corresponde a um achado do laudo AUDITORIA_RADAR_05_VERIFICACAO_CICLO5.md
 * (08/09/2026). Rode com: npm test -- tests/audit-gate.test.ts
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const read = (rel: string) => readFileSync(path.join(ROOT, rel), 'utf-8');

describe('Audit Gate — Ciclo 5', () => {
  // -------------------------------------------------------------------------
  // C5-02 / C5-03 (RESOLVIDO em 08/09 apos o laudo — este teste e protecao de
  // regressao, nao um achado aberto): QuoteView.tsx tinha texto fixo "SPOT: REAL
  // (TASTYTRADE)", "NET GEX POSITIVO" e "FED 4.50%" incondicionais. Confirmado
  // removido por leitura direta do codigo nesta auditoria (09/09). Este teste
  // trava para que ninguem reintroduza o padrao.
  // -------------------------------------------------------------------------
  it('C5-02/03: QuoteView nao reintroduz texto fixo enganoso sobre dado ao vivo', () => {
    // Remove comentarios de bloco antes de checar — o proprio codigo tem um
    // comentario HONESTO citando essas frases para explicar o que foi corrigido
    // (achado C5-01/C5-02/C5-03), e isso NAO deve contar como reincidencia.
    const srcRaw = read('src/components/quote/QuoteView.tsx');
    const src = srcRaw.replace(/\/\*[\s\S]*?\*\//g, '');
    const forbidden = ['NET GEX POSITIVO', 'FED 4.50%', 'FED 4,50%', 'SPOT: REAL (TASTYTRADE)'];
    for (const phrase of forbidden) {
      expect(
        src.includes(phrase),
        `QuoteView.tsx voltou a conter o texto fixo "${phrase}" (achado C5-02/03). ` +
          `Isso e uma regressao de um achado ja corrigido — nao reintroduza string ` +
          `estatica onde o valor precisa vir do dado real ou ser rotulado como catalogo.`
      ).toBe(false);
    }
  });

  // -------------------------------------------------------------------------
  // C5-04 (RESOLVIDO em 08/09 — protecao de regressao): ai-consultant.ts tinha
  // currentRatio/ebitdaMargin/priceToBook fabricados, duplicando um padrao ja
  // removido de QuoteView.tsx. Confirmado null nos 3 campos por leitura direta.
  // -------------------------------------------------------------------------
  it('C5-04: ai-consultant.ts nao reintroduz fundamentos fabricados', () => {
    const src = read('src/lib/domain/ai-consultant.ts');
    expect(
      /currentRatio:\s*1\.45/.test(src) || /ebitdaMargin:\s*0\.28/.test(src),
      'ai-consultant.ts voltou a ter currentRatio/ebitdaMargin como constante fabricada ' +
        '(achado C5-04). Estes campos devem ser null quando a fonte real nao tiver o dado.'
    ).toBe(false);
  });

  // -------------------------------------------------------------------------
  // C5-05 (RESOLVIDO em 09/09 — commit 5c574f5 — protecao de regressao):
  // gex-engine.ts fabricava vencimento fixo ("260918") no simbolo OCC de toda
  // call/put wall. Confirmado corrigido por leitura direta: symbol agora vem de
  // opt.symbol (contrato real), nao de constante.
  // -------------------------------------------------------------------------
  it('C5-05: gex-engine.ts nao reintroduz vencimento fixo no simbolo OCC das walls', () => {
    const src = read('src/lib/domain/gex-engine.ts');
    expect(
      /260918/.test(src),
      'gex-engine.ts voltou a ter a data de vencimento fixa "260918" hardcoded no simbolo ' +
        'OCC de toda call/put wall (achado C5-05, ja corrigido em 5c574f5 — isto seria uma ' +
        'regressao). O vencimento embutido no simbolo precisa vir do contrato real.'
    ).toBe(false);
  });

  // -------------------------------------------------------------------------
  // C5-06a (RESOLVIDO em 09/09 — commit 5c574f5 — protecao de regressao):
  // delta/IV por strike usavam fallback de constante magica (`|| 0.5`, `|| 35`).
  // Confirmado corrigido: `delta: s.callDelta` / `iv: s.callIv`, sem fallback.
  // -------------------------------------------------------------------------
  it('C5-06a: gex-engine.ts nao reintroduz fallback de constante magica para delta/IV', () => {
    const src = read('src/lib/domain/gex-engine.ts');
    expect(
      /\|\|\s*0\.5\b/.test(src) || /\|\|\s*35\b/.test(src),
      'gex-engine.ts voltou a usar fallback por constante magica para delta (`|| 0.5`) ou ' +
        'IV (`|| 35`) (achado C5-06a, ja corrigido em 5c574f5 — isto seria uma regressao). ' +
        'Sem o dado real, a funcao deve propagar indisponibilidade, nao inventar um valor plausivel.'
    ).toBe(false);
  });

  // -------------------------------------------------------------------------
  // C5-06b (REABERTO em 09/09 — verificacao pos-commit 5c574f5): o fallback de
  // `topCallWall`/`topPutWall` saiu de `spotPrice * 1.05`/`* 0.95` para
  // `?? spotPrice` puro. Isso passa na letra do teste antigo, mas continua sendo
  // o mesmo problema: quando nao ha strike real de OI concentrado, a funcao nao
  // propaga "indisponivel" — ela substitui por um numero inventado (agora o
  // proprio spot). Isso pode fazer a UI mostrar distancePct: 0%, sugerindo "pin
  // exatamente no preco atual" quando na verdade e ausencia de dado. O mesmo
  // padrao tambem nao foi tocado em `pinCandidate` (ainda usa `|| spotPrice`).
  // -------------------------------------------------------------------------
  it('C5-06b: gex-engine.ts nao usa spotPrice como valor de wall/pin quando nao ha strike real', () => {
    const src = read('src/lib/domain/gex-engine.ts');
    const lines = src.split('\n');
    const targets = ['topCallWall', 'topPutWall', 'pinCandidate'];
    const offendingLines = lines.filter(line => {
      const assignsTarget = targets.some(t => new RegExp(`\\b${t}\\s*=`).test(line));
      if (!assignsTarget) return false;
      return /(\?\?|\|\|)\s*spotPrice\b/.test(line);
    });

    expect(
      offendingLines.length,
      'gex-engine.ts ainda usa `spotPrice` como fallback de topCallWall/topPutWall/' +
        'pinCandidate quando nao ha strike real com OI (achado C5-06b — forma mais sutil ' +
        'do mesmo achado C5-06, que trocou o offset `* 1.05/0.95` pelo spot puro em vez ' +
        'de eliminar o fallback). Linhas encontradas:\n' + offendingLines.join('\n') + '\n' +
        'Esses campos devem propagar null/undefined (e a UI deve tratar como "sem dado", ' +
        'igual ao padrao ja usado em volRecStatus === \'unavailable\' em QuoteView.tsx), ' +
        'nunca equiparar wall/pin ao preco a vista.'
    ).toBe(0);
  });

  // -------------------------------------------------------------------------
  // C5-07 (AINDA ABERTO — confirmado presente em 09/09): src/lib/types/provenance.ts
  // define ProvenanceBadge/combineProvenance mas nenhum componente sob src/components
  // ou src/app importa/usa isso de fato (so ha um re-export em types/index.ts).
  // -------------------------------------------------------------------------
  it('C5-07: provenance.ts esta de fato conectado a algum componente da UI', () => {
    expect(
      existsSync(path.join(ROOT, 'src/lib/types/provenance.ts')),
      'src/lib/types/provenance.ts nao existe mais — se foi renomeado/movido, atualize este teste.'
    ).toBe(true);

    // Varre todo arquivo .tsx/.ts sob src/components e src/app procurando uso real
    // (nao a definicao em si nem o barrel de types).
    const { execSync } = require('child_process');
    let matches = '';
    try {
      matches = execSync(
        `grep -rl "ProvenanceBadge\\|combineProvenance" src/components src/app 2>/dev/null || true`,
        { cwd: ROOT, encoding: 'utf-8' }
      );
    } catch {
      matches = '';
    }

    expect(
      matches.trim().length > 0,
      'Nenhum arquivo em src/components/ ou src/app/ importa ProvenanceBadge/combineProvenance ' +
        '(achado C5-07). A infraestrutura de proveniencia existe e esta orfa ha dois laudos — ' +
        'conecte pelo menos um componente real (ex.: um badge por campo em QuoteView.tsx) ' +
        'antes de fechar este achado.'
    ).toBe(true);
  });

  // -------------------------------------------------------------------------
  // C5-01 (AINDA ABERTO): US_STOCKS_DATASET e SP500_DATASET sao catalogos
  // estaticos sem nenhum campo de timestamp/fonte por entrada — impossivel saber,
  // por codigo, ha quanto tempo um numero esta congelado.
  // -------------------------------------------------------------------------
  it('C5-01: catalogos estaticos expoem um campo de marca-dagua de data/fonte', () => {
    const files = ['src/lib/domain/us-market-data.ts', 'src/lib/domain/sp500-dataset.ts'];
    for (const f of files) {
      const src = read(f);
      const hasFreshnessField = /lastUpdated|dataAsOf|snapshotDate|frozenAt/.test(src);
      expect(
        hasFreshnessField,
        `${f} nao tem nenhum campo de tipo (lastUpdated/dataAsOf/snapshotDate/frozenAt) ` +
          'nas entradas do catalogo (achado C5-01). Sem isso, nao ha como a UI ou um teste ' +
          'saber, de forma mecanica, ha quanto tempo um numero esta congelado.'
      ).toBe(true);
    }
  });

  // -------------------------------------------------------------------------
  // C5-08 (AINDA ABERTO): README.md afirma "nenhum numero sintetico e mascarado
  // como dado de mercado em tempo real" — falso enquanto C5-01 (catalogo estatico
  // sem refresh) nao for corrigido.
  // -------------------------------------------------------------------------
  it('C5-08: README nao faz alegacao de integridade que o codigo ainda nao sustenta', () => {
    const readme = read('README.md');
    const claim = /nenhum n[uú]mero sint[eé]tico [eé] mascarado como dado de mercado em tempo real/i;
    const hasClaim = claim.test(readme);

    if (!hasClaim) return; // alegacao removida — ok

    // Se a alegacao ainda existe, so e aceitavel quando C5-01 estiver de fato
    // resolvido (catalogos com marca-dagua de frescor).
    const usData = read('src/lib/domain/us-market-data.ts');
    const spData = read('src/lib/domain/sp500-dataset.ts');
    const freshnessPattern = /lastUpdated|dataAsOf|snapshotDate|frozenAt/;
    const catalogsAreHonest = freshnessPattern.test(usData) && freshnessPattern.test(spData);

    expect(
      catalogsAreHonest,
      'README.md ainda afirma que "nenhum numero sintetico e mascarado como dado de ' +
        'mercado em tempo real" (achado C5-08), mas US_STOCKS_DATASET/SP500_DATASET ' +
        'continuam sem marca-dagua de frescor (achado C5-01) — a alegacao do README ' +
        'nao e sustentada pelo codigo atual. Corrija C5-01 primeiro, ou reescreva a ' +
        'frase do README para refletir a realidade (ex.: citar quais telas sao ao vivo ' +
        'e quais sao catalogo).'
    ).toBe(true);
  });

  // -------------------------------------------------------------------------
  // C5-16 (AINDA ABERTO): ESLint so cobre 2 dos 8 invariantes da REGRA 00
  // (Math.random e catch vazio). Nao ha barreira mecanica contra o padrao
  // `|| <numero>` / `spot * 1.0x` que causou C5-01, C5-02/03 e C5-06.
  // -------------------------------------------------------------------------
  // -------------------------------------------------------------------------
  // FASE 1 (10/09) — inventario completo das 7 telas encontrou fabricacao/
  // rotulo falso fora do escopo do Ciclo 5. Decisao do usuario: remover por
  // hora (nao construir dado real ainda). Estes testes travam a remocao.
  // -------------------------------------------------------------------------

  it('FASE1-01: aba "Panorama Geral" foi removida (tela 100% fabricada, sem nenhuma fonte de dado)', () => {
    const navbar = read('src/components/layout/Navbar.tsx');
    const page = read('src/app/page.tsx');

    expect(
      /['"]panorama['"]/.test(navbar) || /Panorama Geral/.test(navbar),
      'Navbar.tsx ainda referencia a aba "panorama"/"Panorama Geral". Esta aba era ' +
        '100% fabricada (termometro de sentimento, 5 pilares, VIX/SKEW/macro) sem ' +
        'nenhuma chamada de API ou catalogo por tras — decisao foi remover, nao corrigir ' +
        'aos poucos. Remova a entrada de "panorama" de navItems e do tipo ActiveTab.'
    ).toBe(false);

    expect(
      /PanoramaView/.test(page),
      'page.tsx ainda importa ou renderiza PanoramaView. Remova o import e o bloco ' +
        '<div id="panel-panorama">.'
    ).toBe(false);

    expect(
      /useState<ActiveTab>\(['"]panorama['"]\)/.test(page),
      'O activeTab default de page.tsx ainda comeca em "panorama". Troque para outra ' +
        'aba (ex.: "consulta", que ja passou pelo Ciclo 5 e tem proveniencia honesta).'
    ).toBe(false);

    expect(
      existsSync(path.join(ROOT, 'src/components/panorama/PanoramaView.tsx')),
      'src/components/panorama/PanoramaView.tsx ainda existe no repositorio. Apague o ' +
        'arquivo — nao deixe como codigo morto desreferenciado (isso so recria o mesmo ' +
        'problema que auditorias anteriores ja apontaram: dead code sem explicacao).'
    ).toBe(false);
  });

  it('FASE1-02: tarja de VIX/SKEW/SPX Net GEX hardcoded foi removida da Analista de Volatilidade', () => {
    const src = read('src/components/volatility/VolatilityAnalystView.tsx');
    const forbidden = ['VIX Spot:', 'VIX9D/VIX3M', 'CBOE SKEW', 'SPX Net GEX'];
    for (const phrase of forbidden) {
      expect(
        src.includes(phrase),
        `VolatilityAnalystView.tsx ainda contem "${phrase}" — essa tarja inteira (VIX ` +
          'Spot: 15.42, VIX9D/VIX3M: 0.86, CBOE SKEW: 138.2, SPX Net GEX: +$3.82 B) era ' +
          'literal fixo no JSX, sem nenhuma variavel ou chamada de API. Remova o bloco ' +
          'inteiro em vez de deixar parte dele.'
      ).toBe(false);
    }
  });

  it('FASE1-03: badge "Fonte: Tastytrade Live" colado ao Spot foi removido (nao correspondia ao spot)', () => {
    const src = read('src/components/volatility/VolatilityAnalystView.tsx');
    expect(
      src.includes('Fonte: Tastytrade Live'),
      'VolatilityAnalystView.tsx ainda contem o texto "Fonte: Tastytrade Live". Esse ' +
        'badge testava liveMetricsMap[...]?.source, um campo de IV/GEX, nao do spot — ' +
        'mas ficava posicionado visualmente colado ao Spot (que vem do catalogo ' +
        'estatico, nunca atualizado pelo merge com dado ao vivo). Remova o badge; nao ' +
        'precisa adicionar um novo badge "ESTIMADO" nesta rodada, so tirar a alegacao falsa.'
    ).toBe(false);
  });

  it('FASE1-04: ScreenerView nao alega continuidade/dado real que o catalogo estatico nao sustenta', () => {
    const src = read('src/components/screener/ScreenerView.tsx');
    expect(
      src.includes('Escaneamento contínuo') || src.includes('Escaneamento continuo'),
      'ScreenerView.tsx ainda diz "Escaneamento contínuo das ações do S&P 500..." — a ' +
        'lista vem de US_STOCKS_DATASET estatico, sem nenhum merge com dado ao vivo. ' +
        'Reescreva para algo honesto (ex.: "Lista de ativos do catálogo S&P 500").'
    ).toBe(false);

    expect(
      src.includes('IV ATM Real Favorável') || src.includes('IV ATM Real Favoravel'),
      'ScreenerView.tsx ainda usa "IV ATM Real Favorável" no criterio da categoria ' +
        'LATERAL — item.ivRank vem do catalogo estatico, nao e "Real". Remova a palavra ' +
        '"Real" desse rotulo.'
    ).toBe(false);

    expect(
      /setTimeout\(\s*\(\)\s*=>\s*setIsRefreshing\(false\)/.test(src),
      'ScreenerView.tsx ainda tem o botao "Atualizar" ligado a um setTimeout que so gira ' +
        'o icone por 400ms sem rebuscar nada (teatro de UI). Remova o handleRefresh falso ' +
        'e o spinner, ou o botao inteiro, ate existir uma rebusca real para conectar a ele.'
    ).toBe(false);
  });

  it('FASE1-05: Manual & Ajuda nao alega GEX "em tempo real" quando o motor e modelo calibrado', () => {
    const src = read('src/components/help/HelpSupportView.tsx');
    expect(
      src.includes('Gamma Exposure (GEX) em tempo real via Tastytrade'),
      'HelpSupportView.tsx ainda descreve o GEX como "em tempo real via Tastytrade" — ' +
        'contradiz o proprio tooltip honesto do motor em UnifiedGexBarreirasView.tsx ' +
        '("modelo parametrico interno... nao representa posicionamento real de ' +
        'mercado"). Reescreva a frase para refletir o que o motor realmente faz.'
    ).toBe(false);
  });

  it('FASE1-06: VolatilityAnalystView nao reintroduz SOFR hardcoded ao lado do Spot', () => {
    const src = read('src/components/volatility/VolatilityAnalystView.tsx');
    expect(
      /SOFR:\s*<strong[^>]*>5\.32%/.test(src),
      'VolatilityAnalystView.tsx ainda mostra "SOFR: 5.32%" como literal fixo, colado ao ' +
        'Spot (mesmo bloco de onde removemos VIX/SKEW/GEX hardcoded no FASE1-02, e o ' +
        'badge falso no FASE1-03). Nao ha variavel nem chamada de API por tras — e o ' +
        'mesmo padrao de fabricacao, so que escapou do inventario original. Remova o ' +
        'valor (ou o campo inteiro) ate existir uma fonte real de SOFR conectada.'
    ).toBe(false);
  });

  it('FASE1-07: VolatilityAnalystView nao reintroduz selo de liquidez fixo "Liquido 5/5"', () => {
    const src = read('src/components/volatility/VolatilityAnalystView.tsx');
    expect(
      src.includes('Líquido 5/5') || src.includes('Liquido 5/5'),
      'VolatilityAnalystView.tsx ainda mostra o selo "Líquido 5/5" colado ao simbolo do ' +
        'ativo — literal fixo, sem variavel, sem calculo de liquidez por tras. E exatamente ' +
        'o tipo de linguagem de confianca absoluta sobre dado inexistente que a auditoria ' +
        'ja sinalizou como problema de tom (nao so de dado). Remova o selo ate existir uma ' +
        'metrica real de liquidez conectada a ele.'
    ).toBe(false);
  });

  it('FASE2-01: VolatilityAnalystView migrou para <DataValue> (zero .toFixed solto, proveniencia declarada)', () => {
    const src = read('src/components/volatility/VolatilityAnalystView.tsx');

    expect(
      src.includes("import { DataValue } from '@/components/shared/DataValue'"),
      'VolatilityAnalystView.tsx nao importa mais o componente estrutural DataValue -- ' +
        'a migracao da Fase 2 (commits 8768a42, 1686930, 7b3738f) foi revertida.'
    ).toBe(true);

    expect(
      /\.toFixed\(/.test(src),
      'VolatilityAnalystView.tsx voltou a ter .toFixed() solto no componente -- isso ' +
        'reintroduz numero formatado sem badge de proveniencia, o mesmo padrao que ' +
        'causou FASE1-02, FASE1-03, FASE1-06 e FASE1-07 nesta tela. Todo valor numerico ' +
        'exibido deve passar por <DataValue format="..." />.'
    ).toBe(false);

    // Spot/Variacao do catalogo estatico devem declarar a fonte real (nao "Tastytrade"
    // nem nenhuma alegacao de dado ao vivo -- e exatamente o achado FASE1-03 original).
    expect(
      src.includes('source="SP500_DATASET (catálogo estático)"'),
      'VolatilityAnalystView.tsx nao declara mais SP500_DATASET como fonte do Spot/Variacao -- ' +
        'confirme que o campo continua marcado como ESTIMADO com a fonte real do catalogo.'
    ).toBe(true);
  });

  it('FASE2-02: ScreenerView migrou para <DataValue> e expoe dataAsOf do catalogo', () => {
    const src = read('src/components/screener/ScreenerView.tsx');

    expect(
      src.includes("import { DataValue } from '@/components/shared/DataValue'"),
      'ScreenerView.tsx nao importa mais o componente estrutural DataValue -- a migracao ' +
        'da Fase 2 (commit 473f0ed) foi revertida.'
    ).toBe(true);

    expect(
      /\.toFixed\(/.test(src),
      'ScreenerView.tsx voltou a ter .toFixed() solto no componente -- reintroduz numero ' +
        'formatado sem badge de proveniencia.'
    ).toBe(false);

    expect(
      src.includes('US_STOCKS_DATASET (catálogo estático)'),
      'ScreenerView.tsx nao declara mais US_STOCKS_DATASET como fonte de Spot/Var/Stop/Alvo -- ' +
        'confirme que os campos continuam marcados como ESTIMADO com a fonte real do catalogo.'
    ).toBe(true);

    expect(
      src.includes('US_DATA_AS_OF'),
      'ScreenerView.tsx nao expoe mais a marca-dagua de data do catalogo (US_DATA_AS_OF, ' +
        'achado C5-01) -- essa tela era a unica das 7 que nunca mostrava isso.'
    ).toBe(true);
  });

  it('FASE2-03: QuoteView migrou ProvenanceTag local para <DataValue> e nao alega vencimento fixo', () => {
    const src = read('src/components/quote/QuoteView.tsx');

    expect(
      src.includes("import { DataValue } from '@/components/shared/DataValue'"),
      'QuoteView.tsx nao importa mais o componente estrutural DataValue -- a migracao ' +
        'da Fase 2 (commits d4c3304, 9e63429) foi revertida.'
    ).toBe(true);

    expect(
      /function ProvenanceTag/.test(src),
      'QuoteView.tsx voltou a definir um ProvenanceTag local -- a tela deve usar o ' +
        'DataValue estrutural compartilhado, nao reimplementar o badge por conta propria.'
    ).toBe(false);

    expect(
      /\.toFixed\(/.test(src),
      'QuoteView.tsx voltou a ter .toFixed() solto no componente.'
    ).toBe(false);

    // Achado especifico desta rodada: a badge OPCOES mostrava uma data de vencimento
    // fixa (2026-09-18) independente do ticker ou do status do fetch real.
    expect(
      src.includes('2026-09-18'),
      'QuoteView.tsx voltou a ter a data de vencimento fixa "2026-09-18" na badge ' +
        'OPCOES -- deve usar electedStrategy.expirationDate/.dte quando disponivel, ou ' +
        'INDISPONIVEL/N-D quando nao houver recomendacao pronta.'
    ).toBe(false);
  });

  it('C5-16: ESLint tem uma regra contra fallback numerico magico em domain/services', () => {
    const eslintrc = read('.eslintrc.json');
    const hasMagicFallbackRule =
      /no-restricted-syntax/.test(eslintrc) &&
      (eslintrc.match(/no-restricted-syntax/g) || []).length >= 1 &&
      /\|\|/.test(eslintrc); // regra customizada citando o padrao `||` no proprio JSON

    expect(
      hasMagicFallbackRule,
      '.eslintrc.json ainda cobre so Math.random()/catch vazio (achado C5-16). Adicione ' +
        'uma regra no-restricted-syntax que capture o padrao `|| <numero literal>` dentro ' +
        'de src/lib/domain/ e src/lib/services/ — isso teria pego C5-06 automaticamente.'
    ).toBe(true);
  });
});
