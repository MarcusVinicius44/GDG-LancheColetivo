import { useMemo } from 'react'
import { Link, Navigate, useParams } from 'react-router'
import { ProgressBar } from '@/components/ProgressBar'
import { useAuth } from '@/hooks/useAuth'
import {
  useAgora,
  useBloqueios,
  useCancelamentos,
  useEvento,
  useNeeds,
  usePledges,
  useUsuarios,
} from '@/hooks/useFirestore'
import { lacunas } from '@/lib/exportar'
import { rotuloFase } from '@/lib/fase'
import { formatDataHora } from '@/lib/format'
import { agruparPorCategoria, resumir } from '@/lib/needView'
import { ContribuicoesAdmin } from '@/pages/admin/ContribuicoesAdmin'
import { ExportPanel } from '@/pages/admin/ExportPanel'
import { ReabrirPrazo } from '@/pages/admin/ReabrirPrazo'

export function AdminEvento() {
  const { id } = useParams()
  const { isAdmin, loading } = useAuth()
  const { data: evento, loading: loadingEv } = useEvento(id)
  const { data: needs } = useNeeds(id)
  const { data: pledges } = usePledges(id)
  const { data: cancelamentos } = useCancelamentos(id, isAdmin)
  const { data: usuarios } = useUsuarios(isAdmin)
  const { data: bloqueios } = useBloqueios(isAdmin)
  const agora = useAgora()

  const resumo = useMemo(() => resumir(needs), [needs])
  const gaps = useMemo(() => lacunas(needs), [needs])
  const grupos = useMemo(() => agruparPorCategoria(gaps.map((g) => g.need)), [gaps])
  const faltaDe = useMemo(() => new Map(gaps.map((g) => [g.need.id, g.faltam])), [gaps])
  const nomeDe = useMemo(() => new Map(needs.map((n) => [n.id, n])), [needs])

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

  const selo = rotuloFase(evento, agora)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link to="/admin" className="text-sm text-gdg-blue">
          ← Administração
        </Link>
        <Link to={`/e/${evento.id}`} className="btn-ghost">
          Ver página pública
        </Link>
      </div>

      <section className="card space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="text-2xl font-medium leading-tight">{evento.titulo}</h1>
            <p className="text-sm text-muted">
              {formatDataHora(evento.inicio)} · {evento.local}
            </p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${selo.cor}`}>{selo.texto}</span>
        </div>
        <div className="space-y-1.5">
          <ProgressBar valor={resumo.percentual} meta={100} rotulo="Progresso geral" />
          <p className="text-sm text-muted">
            {resumo.completas} de {resumo.total} itens completos · {pledges.length} contribuição(ões)
          </p>
        </div>
        <ReabrirPrazo evento={evento} agora={agora} />
      </section>

      <section className="card space-y-3" aria-labelledby="lac-t">
        <h2 id="lac-t" className="text-lg font-medium">
          Lacunas ({gaps.length})
        </h2>
        {gaps.length === 0 && <p className="text-sm text-gdg-green">Tudo garantido! 🎉</p>}
        {grupos.map((g) => (
          <div key={g.categoria} className="space-y-2">
            <h3 className="text-sm font-medium text-muted">{g.categoria}</h3>
            <ul className="space-y-2">
              {g.needs.map((n) => (
                <li key={n.id} className="space-y-1">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-medium">{n.nome}</span>
                    <span className="shrink-0 text-muted">
                      faltam {faltaDe.get(n.id)} de {n.meta} ({n.unidade})
                    </span>
                  </div>
                  <ProgressBar valor={n.reservado} meta={n.meta} rotulo={`Progresso de ${n.nome}`} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      {cancelamentos.length > 0 && (
        <section className="card space-y-2 border-gdg-yellow" aria-labelledby="tard-t">
          <h2 id="tard-t" className="text-lg font-medium">
            Cancelamentos tardios ({cancelamentos.length})
          </h2>
          <p className="text-sm text-muted">Quem reduziu ou cancelou depois do prazo — as unidades voltaram a faltar.</p>
          <ul className="space-y-1 text-sm">
            {cancelamentos.map((c) => (
              <li key={c.id}>
                <strong className="font-medium">{c.primeiroNome}</strong> liberou {c.qty} ×{' '}
                {nomeDe.get(c.needId)?.nome ?? c.needId}
                {usuarios.get(c.uid)?.email && <span className="text-muted"> ({usuarios.get(c.uid)?.email})</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <ContribuicoesAdmin eventId={evento.id} needs={needs} pledges={pledges} usuarios={usuarios} bloqueios={bloqueios} />

      <ExportPanel evento={evento} needs={needs} pledges={pledges} usuarios={usuarios} />
    </div>
  )
}
