interface Props {
  valor: number
  meta: number
  /** Texto para leitores de tela (ex.: "Refrigerante"). */
  rotulo: string
  className?: string
}

export function ProgressBar({ valor, meta, rotulo, className = '' }: Props) {
  const pct = meta > 0 ? Math.min(Math.round((valor / meta) * 100), 100) : 0
  const completo = valor >= meta
  return (
    <div
      role="progressbar"
      aria-label={rotulo}
      aria-valuemin={0}
      aria-valuemax={meta}
      aria-valuenow={Math.min(valor, meta)}
      className={`h-2.5 w-full overflow-hidden rounded-full bg-line/60 ${className}`}
    >
      <div
        className={`h-full rounded-full transition-[width] duration-500 ${completo ? 'bg-gdg-green' : 'bg-gdg-blue'}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
