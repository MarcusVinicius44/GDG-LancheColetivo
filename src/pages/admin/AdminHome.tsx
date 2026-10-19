import { useState } from 'react'
import { Link, Navigate } from 'react-router'
import { db } from '@/config/firebase'
import { useAuth } from '@/hooks/useAuth'
import { useAgora, useEventos } from '@/hooks/useFirestore'
import { criarEventoHalloween, criarEventoTeste, EVENTO_TESTE, fecharEvento, publicarEvento } from '@/lib/eventos'
import { rotuloFase } from '@/lib/fase'
import { formatDataHora } from '@/lib/format'
import { HALLOWEEN_EVENT, HALLOWEEN_NEEDS } from '@/templates/halloween'

export function AdminHome() {
  const { isAdmin, loading } = useAuth()
  const { data: eventos } = useEventos()
  const agora = useAgora()
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  if (loading) return null
  if (!isAdmin) return <Navigate to="/" replace />

  const jaExiste = eventos.some((e) => e.id === HALLOWEEN_EVENT.id)
  const jaExisteTeste = eventos.some((e) => e.id === EVENTO_TESTE.id)

  async function rodar(chave: string, fn: () => Promise<unknown>) {
    setOcupado(chave)
    setErro(null)
    try {
      await fn()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível concluir a ação.')
    } finally {
      setOcupado(null)
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-medium">Administração</h1>

      {erro && (
        <p role="alert" className="card text-sm text-gdg-red">
          {erro}
        </p>
      )}

      {!jaExiste && (
        <section className="card space-y-2">
          <h2 className="text-lg font-medium">Criar a partir de template</h2>
          <p className="text-sm text-muted">
            {HALLOWEEN_EVENT.titulo} — {formatDataHora(HALLOWEEN_EVENT.inicio)} · público {HALLOWEEN_EVENT.publicoPlanejado} ·{' '}
            {HALLOWEEN_NEEDS.length} itens. Nasce como <strong>rascunho</strong>: só você vê até publicar.
          </p>
          <button
            type="button"
            className="btn-primary"
            disabled={ocupado !== null}
            onClick={() => rodar('template', () => criarEventoHalloween(db))}
          >
            {ocupado === 'template' ? 'Criando…' : 'Criar evento Halloween (rascunho)'}
          </button>
        </section>
      )}

      {!jaExisteTeste && (
        <section className="card space-y-2">
          <h2 className="text-lg font-medium">Evento de teste</h2>
          <p className="text-sm text-muted">
            Cópia do Halloween chamada “{EVENTO_TESTE.titulo}”, para testar em produção sem sujar o evento real. Também
            nasce como <strong>rascunho</strong>.
          </p>
          <button
            type="button"
            className="btn-ghost"
            disabled={ocupado !== null}
            onClick={() => rodar('teste', () => criarEventoTeste(db))}
          >
            {ocupado === 'teste' ? 'Criando…' : 'Criar evento de teste (rascunho)'}
          </button>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Eventos</h2>
        {eventos.length === 0 && <p className="text-sm text-muted">Nenhum evento ainda.</p>}
        {eventos.map((ev) => {
          const selo = rotuloFase(ev, agora)
          return (
            <article key={ev.id} className="card space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-medium">{ev.titulo}</h3>
                  <p className="text-sm text-muted">{formatDataHora(ev.inicio)}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-medium ${selo.cor}`}>{selo.texto}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link to={`/admin/e/${ev.id}`} className="btn-primary">
                  Gerenciar
                </Link>
                <Link to={`/admin/e/${ev.id}/itens`} className="btn-ghost">
                  Itens e metas
                </Link>
                <Link to={`/e/${ev.id}`} className="btn-ghost">
                  Página pública
                </Link>
                {ev.status === 'rascunho' && (
                  <button
                    type="button"
                    className="btn-ghost"
                    disabled={ocupado !== null}
                    onClick={() => rodar(ev.id, () => publicarEvento(db, ev.id))}
                  >
                    Publicar
                  </button>
                )}
                {ev.status === 'aberto' && (
                  <button
                    type="button"
                    className="btn-ghost"
                    disabled={ocupado !== null}
                    onClick={() => rodar(ev.id, () => fecharEvento(db, ev.id))}
                  >
                    Encerrar contribuições
                  </button>
                )}
              </div>
            </article>
          )
        })}
      </section>

    </div>
  )
}
