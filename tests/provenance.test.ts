import { describe, it, expect } from 'vitest';
import { combineProvenance, ProvenanceBadge } from '@/lib/types/provenance';

describe('Proveniência de Dados — Regra estrita de contágio', () => {
  it('retorna MEDIDO quando todos os insumos são puramente medidos', () => {
    const inputs: ProvenanceBadge[] = ['MEDIDO', 'MEDIDO', 'MEDIDO'];
    expect(combineProvenance(inputs)).toBe('MEDIDO');
  });

  it('retorna DERIVADO quando há mistura de MEDIDO e DERIVADO sem proxies', () => {
    const inputs: ProvenanceBadge[] = ['MEDIDO', 'DERIVADO', 'MEDIDO'];
    expect(combineProvenance(inputs)).toBe('DERIVADO');
  });

  it('retorna ESTIMADO quando qualquer insumo é modelo/proxy (na ausência de SIMULADO ou INDISPONIVEL)', () => {
    const inputs: ProvenanceBadge[] = ['MEDIDO', 'DERIVADO', 'ESTIMADO'];
    expect(combineProvenance(inputs)).toBe('ESTIMADO');
  });

  it('retorna INDISPONIVEL quando qualquer insumo falha na fonte (sem SIMULADO)', () => {
    // Caso: preço spot é MEDIDO, mas volatilidade da fonte é INDISPONIVEL -> cálculo fica INDISPONIVEL
    const inputs: ProvenanceBadge[] = ['MEDIDO', 'INDISPONIVEL', 'DERIVADO'];
    expect(combineProvenance(inputs)).toBe('INDISPONIVEL');
  });

  it('SIMULADO contamina mesmo sobrepondo INDISPONIVEL (pior caso absoluto)', () => {
    // Caso assimétrico: fonte falhou (INDISPONIVEL) mas alguém tentou alimentar com mock SIMULADO
    // -> deve permanecer SIMULADO para não mascarar dado sintético
    const inputs: ProvenanceBadge[] = ['INDISPONIVEL', 'SIMULADO', 'MEDIDO'];
    expect(combineProvenance(inputs)).toBe('SIMULADO');
  });

  it('lida com lista vazia retornando MEDIDO como caso base', () => {
    expect(combineProvenance([])).toBe('MEDIDO');
  });

  it('herda ESTIMADO quando a data de earnings é projetada/estimada (Caso A do Screener)', () => {
    // Projeção estatística de earnings (ESTIMADO) + Vencimento calculado deterministicamente (DERIVADO) + Preço MEDIDO
    const structureInputs: ProvenanceBadge[] = ['ESTIMADO', 'DERIVADO', 'MEDIDO'];
    expect(combineProvenance(structureInputs)).toBe('ESTIMADO');
  });

  it('mantém DERIVADO quando a data de earnings é confirmada pela empresa (MEDIDO)', () => {
    // Data confirmada pela empresa (MEDIDO) + Vencimento calculado deterministicamente (DERIVADO) + Preço MEDIDO
    const structureInputs: ProvenanceBadge[] = ['MEDIDO', 'DERIVADO', 'MEDIDO'];
    expect(combineProvenance(structureInputs)).toBe('DERIVADO');
  });

  it('herda INDISPONIVEL quando qualquer perna de opção falha na chamada de API', () => {
    // Perna Call MEDIDA, mas Perna Put falhou na API (INDISPONIVEL) -> Estrutura inteira fica INDISPONIVEL
    const structureInputs: ProvenanceBadge[] = ['MEDIDO', 'INDISPONIVEL', 'DERIVADO'];
    expect(combineProvenance(structureInputs)).toBe('INDISPONIVEL');
  });
});

describe('DataValue — Componente Estrutural e Variante Inline', () => {
  it('renderiza variant inline como span por padrao com format currency', async () => {
    const { DataValue } = await import('@/components/shared/DataValue');
    const elem = DataValue({
      value: 125.4,
      provenance: 'SIMULADO',
      source: 'Modelo interno',
      format: 'currency',
      variant: 'inline',
    });

    expect(elem.type).toBe('span');
    expect(elem.props.children).toBe('$125.40');
  });

  it('renderiza variant inline com tag customizada as="tspan"', async () => {
    const { DataValue } = await import('@/components/shared/DataValue');
    const elem = DataValue({
      value: 50.5,
      provenance: 'ESTIMADO',
      source: 'Modelo GEX',
      format: 'currency',
      variant: 'inline',
      as: 'tspan',
    });

    expect(elem.type).toBe('tspan');
    expect(elem.props.children).toBe('$50.50');
  });

  it('renderiza N/D quando value e nulo em variant inline', async () => {
    const { DataValue } = await import('@/components/shared/DataValue');
    const elem = DataValue({
      value: null,
      provenance: 'MEDIDO',
      source: 'Tastytrade REST',
      format: 'currency',
      variant: 'inline',
    });

    expect(elem.props.children).toBe('N/D');
  });

  it('renderiza format integer com separadores de milhar en-US', async () => {
    const { DataValue } = await import('@/components/shared/DataValue');
    const elem = DataValue({
      value: 125430,
      provenance: 'ESTIMADO',
      source: 'Modelo GEX',
      format: 'integer',
      variant: 'inline',
    });

    expect(elem.props.children).toBe('125,430');
  });

  it('exporta formatDataValue diretamente para uso em relatórios/clipboard sem quebrar a regra', async () => {
    const { formatDataValue } = await import('@/components/shared/DataValue');
    expect(formatDataValue(1234.56, 'currency')).toBe('$1,234.56');
    expect(formatDataValue(1234.56, 'number', 1)).toBe('1,234.6');
    expect(formatDataValue(50000, 'integer')).toBe('50,000');
  });
});

describe('Regressão de Integridade da Cerca (Achado 4)', () => {
  it('.eslintrc.json cobre src/app e restringe toLocaleString e Intl.NumberFormat', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const eslintrc = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../.eslintrc.json'), 'utf-8'));

    const uiOverride = eslintrc.overrides?.find((o: any) =>
      Array.isArray(o.files) && o.files.some((f: string) => f.includes('src/components'))
    );

    expect(uiOverride).toBeDefined();
    expect(uiOverride.files).toContain('src/app/**/*.tsx');

    const restricted = uiOverride.rules?.['no-restricted-syntax'];
    expect(restricted).toBeDefined();

    const selectors = restricted.slice(1).map((r: any) => r.selector);
    expect(selectors.some((s: string) => s.includes('toLocaleString'))).toBe(true);
    expect(selectors.some((s: string) => s.includes('Intl') && s.includes('NumberFormat'))).toBe(true);
  });

  it('nenhum componente ou pagina em src/ usa .toLocaleString() fora do DataValue.tsx', async () => {
    const fs = await import('fs');
    const path = await import('path');

    const walk = (dir: string): string[] => {
      let results: string[] = [];
      const list = fs.readdirSync(dir, { withFileTypes: true });
      for (const item of list) {
        const full = path.join(dir, item.name);
        if (item.isDirectory()) {
          results = results.concat(walk(full));
        } else if (/\.(tsx|jsx)$/.test(item.name) && !item.name.includes('DataValue.tsx')) {
          results.push(full);
        }
      }
      return results;
    };

    const targetFiles = [
      ...walk(path.resolve(__dirname, '../src/components')),
      ...walk(path.resolve(__dirname, '../src/app')),
    ];

    const violations: string[] = [];
    for (const file of targetFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      if (content.includes('.toLocaleString(') || content.includes('Intl.NumberFormat')) {
        violations.push(path.relative(path.resolve(__dirname, '..'), file));
      }
    }

    expect(
      violations,
      `Arquivos utilizando .toLocaleString() ou Intl.NumberFormat fora de DataValue.tsx: ${violations.join(', ')}`
    ).toEqual([]);
  });
});

