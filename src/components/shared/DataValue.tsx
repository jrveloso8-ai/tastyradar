import React from 'react';
import { ProvenanceBadge } from '@/lib/types/provenance';

export interface DataValueProps {
  label?: string;
  value: number | string | null | undefined;
  provenance: ProvenanceBadge;
  source: string;
  format?: 'currency' | 'percent' | 'number' | 'integer' | 'raw';
  decimals?: number;
  timestamp?: string;
  formula?: string;
  unavailableLabel?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'badge' | 'inline';
  as?: 'span' | 'tspan';
}

const PROVENANCE_COLORS: Record<ProvenanceBadge, string> = {
  MEDIDO: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  DERIVADO: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  ESTIMADO: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  SIMULADO: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
  INDISPONIVEL: 'bg-gray-500/20 text-gray-400 border-gray-500/40',
};

export function ProvenanceTag({ badge, source, formula, timestamp }: {
  badge: ProvenanceBadge;
  source?: string;
  formula?: string;
  timestamp?: string;
}) {
  const tooltip = [
    `Proveniência: ${badge}`,
    source ? `Fonte: ${source}` : null,
    timestamp ? `Timestamp: ${timestamp}` : null,
    formula ? `Fórmula: ${formula}` : null,
  ].filter(Boolean).join(' | ');

  return (
    <span
      title={tooltip}
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold font-mono border cursor-help select-none ${PROVENANCE_COLORS[badge]}`}
    >
      {badge}
    </span>
  );
}

export function formatDataValue(
  val: number | string,
  format: 'currency' | 'percent' | 'number' | 'integer' | 'raw' = 'raw',
  decimals?: number
): string {
  if (format === 'raw') return String(val);

  const num = typeof val === 'number' ? val : parseFloat(String(val));
  if (Number.isNaN(num)) return String(val);

  switch (format) {
    case 'currency': {
      const dec = decimals ?? 2;
      return `$${num.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec })}`;
    }
    case 'percent': {
      const dec = decimals ?? 2;
      return `${num.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec })}%`;
    }
    case 'integer':
      return Math.round(num).toLocaleString('en-US');
    case 'number': {
      const dec = decimals ?? 2;
      return num.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
    }
    default:
      return String(val);
  }
}

/**
 * <DataValue /> — Componente estrutural obrigatório para exibição de métricas numéricas.
 * 
 * Regra 00:
 * 1. Label + valor formatado + badge de proveniência sempre juntos (no modo default).
 * 2. Ausência de dado (null/undefined) exibe "N/D" em estilo neutro, nunca esconde nem mascara.
 * 3. Declaração obrigatória de provenance e source em todos os modos.
 * 4. variant="inline": renderiza somente o texto formatado (ou N/D), preservando a exigência
 *    estrutural de tipagem sem poluir gráficos com dezenas de badges repetidos.
 */
export function DataValue({
  label,
  value,
  provenance,
  source,
  format = 'raw',
  decimals,
  timestamp,
  formula,
  unavailableLabel = 'N/D',
  className = '',
  size = 'md',
  variant = 'badge',
  as = 'span',
}: DataValueProps) {
  const isAvailable = value !== null && value !== undefined && value !== '' && !Number.isNaN(value);
  const activeProvenance: ProvenanceBadge = isAvailable ? provenance : 'INDISPONIVEL';

  if (variant === 'inline') {
    const Component = as as any;
    return (
      <Component className={className}>
        {isAvailable ? formatDataValue(value as number | string, format, decimals) : unavailableLabel}
      </Component>
    );
  }

  const labelSize = size === 'sm' ? 'text-[9px]' : size === 'lg' ? 'text-xs' : 'text-[10px]';
  const valSize = size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-xl' : 'text-sm';

  return (
    <div className={`inline-flex flex-col gap-0.5 font-mono ${className}`}>
      <div className="flex items-center gap-1.5">
        {label && (
          <span className={`${labelSize} uppercase text-gray-400 font-semibold tracking-wider`}>
            {label}
          </span>
        )}
        <ProvenanceTag
          badge={activeProvenance}
          source={source}
          formula={formula}
          timestamp={timestamp}
        />
      </div>

      <div className="flex items-baseline gap-1">
        {isAvailable ? (
          <span className={`${valSize} font-bold text-gray-100`}>
            {formatDataValue(value as number | string, format, decimals)}
          </span>
        ) : (
          <span className={`${valSize} font-semibold text-gray-400 italic`}>
            {unavailableLabel}
          </span>
        )}
      </div>
    </div>
  );
}

export default DataValue;
