import { Link, Navigate, useParams, useSearchParams } from 'react-router'
import { useAuth } from '@/hooks/useAuth'
import { useAgora, useEvento, useNeeds, usePledges } from '@/hooks/useFirestore'
import { CategoriasTab } from '@/pages/admin/itens/CategoriasTab'
import { EventoTab } from '@/pages/admin/itens/EventoTab'
import { ItensTab } from '@/pages/admin/itens/ItensTab'

const ABAS = [
  { id: 'itens', rotulo: 'Itens' },
  { id: 'categorias', rotulo: 'Categorias' },
  { id: 'evento', rotulo: 'Dados do evento' },
] as const
type Aba = (typeof ABAS)[number]['id']

/** `/admin/e/:id/itens`: criar, editar e remover itens, categorias e dados do evento. */
export function AdminItens() {
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const { isAdmin, loading } = useAuth()
  const { data: evento, loading: loadingEv } = useEvento(id)
  const { data: needs } = useNeeds(id)
  const { data: pledges } = usePledges(id)
  const agora = useAgora()

  const aba: Aba = ABAS.some((a) => a.id === params.get('aba')) ? (params.get('aba') as Aba) : 'itens'

  if (loading) return null
  if (!isAdmin) return <Navigate to="/" replace />
  if (loadingEv) return <p className="text-muted">Carregando…</p>
  if (!evento) {
    return (
      <section className="card space-y-3">
        <p>Evento não encontrado.</p>
        <Link to="/admin" className="btn-ghost w-fit">
          Voltar
        </Link>
      </section>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link to={`/admin/e/${evento.id}`} className="text-sm text-gdg-blue">
          ← Gerenciar evento
        </Link>
        <Link to={`/e/${evento.id}`} className="btn-ghost">
          Ver página pública
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-medium leading-tight">Itens e metas</h1>
        <p className="text-sm text-muted">{evento.titulo}</p>
      </div>

      <div role="tablist" aria-label="Seções" className="flex flex-wrap gap-2">
        {ABAS.map((a) => (
          <button
            key={a.id}
            type="button"
            role="tab"
            aria-selected={aba === a.id}
            className={aba === a.id ? 'btn-primary' : 'btn-ghost'}
            onClick={() => setParams(a.id === 'itens' ? {} : { aba: a.id }, { replace: true })}
          >
            {a.rotulo}
          </button>
        ))}
      </div>

      {aba === 'itens' && <ItensTab evento={evento} needs={needs} pledges={pledges} />}
      {aba === 'categorias' && <CategoriasTab evento={evento} needs={needs} />}
      {aba === 'evento' && <EventoTab evento={evento} pledges={pledges} agora={agora} />}
    </div>
  )
}
