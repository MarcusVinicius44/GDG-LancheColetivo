import type { Need, Pledge } from '@/lib/types'

interface Props {
  pledges: Pledge[]
  needs: Need[]
  max: number
  onAbrir: (needId: string) => void
}

export function MinhasContribuicoes({ pledges, needs, max, onAbrir }: Props) {
  if (pledges.length === 0) return null
  const porId = new Map(needs.map((n) => [n.id, n]))
  return (
    <section className="card space-y-3" aria-labelledby="minhas-t">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="minhas-t" className="text-lg font-medium">
          Minhas contribuições
        </h2>
        <span className="text-xs text-muted">
          {pledges.length} de {max} itens
        </span>
      </div>
      <ul className="divide-y divide-line">
        {pledges.map((p) => {
          const n = porId.get(p.needId)
          const detalhe = p.opcao ?? p.textoOutro
          return (
            <li key={p.id} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="truncate font-medium">{n?.nome ?? 'Item'}</p>
                <p className="text-sm text-muted">
                  {p.qty} {n?.unidade}
                  {detalhe && ` · ${detalhe}`}
                  {p.devolverAoFinal && ' · devolver no final'}
                </p>
              </div>
              <button type="button" className="btn-ghost shrink-0" onClick={() => onAbrir(p.needId)}>
                Editar
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
