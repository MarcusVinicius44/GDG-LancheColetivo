import { useState } from 'react'
import { db } from '@/config/firebase'
import { useAuth } from '@/hooks/useAuth'
import type { Bloqueio } from '@/hooks/useFirestore'
import { bloquearUsuario, desbloquearUsuario } from '@/lib/eventos'
import type { Usuario } from '@/lib/exportar'
import { cancelarPledge } from '@/lib/pledges'
import { agruparPorCategoria, descreverPledge, pledgesDaNeed } from '@/lib/needView'
import type { Need, Pledge } from '@/lib/types'

interface Props {
  eventId: string
  needs: Need[]
  pledges: Pledge[]
  usuarios: Map<string, Usuario>
  bloqueios: Bloqueio[]
}

export function ContribuicoesAdmin({ eventId, needs, pledges, usuarios, bloqueios }: Props) {
  const { user } = useAuth()
  const [confirmar, setConfirmar] = useState<string | null>(null)
  const [bloqueando, setBloqueando] = useState<string | null>(null)
  const [motivo, setMotivo] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const bloqueados = new Map(bloqueios.map((b) => [b.uid, b.motivo]))

  async function rodar(fn: () => Promise<unknown>) {
    setOcupado(true)
    setErro(null)
    try {
      await fn()
      setConfirmar(null)
      setBloqueando(null)
      setMotivo('')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível concluir a ação.')
    } finally {
      setOcupado(false)
    }
  }

  const remover = (p: Pledge) =>
    rodar(() => cancelarPledge(db, eventId, p.needId, { uid: user!.uid, nome: user!.displayName }, { donoUid: p.uid }))

  const comPledges = agruparPorCategoria(needs)
    .map((g) => ({ ...g, needs: g.needs.filter((n) => pledgesDaNeed(pledges, n.id).length > 0) }))
    .filter((g) => g.needs.length > 0)

  return (
    <section className="card space-y-3" aria-labelledby="contr-t">
      <h2 id="contr-t" className="text-lg font-medium">
        Contribuições ({pledges.length})
      </h2>
      {erro && (
        <p role="alert" className="text-sm text-gdg-red">
          {erro}
        </p>
      )}
      {comPledges.length === 0 && <p className="text-sm text-muted">Ninguém contribuiu ainda.</p>}

      {comPledges.map((g) => (
        <div key={g.categoria} className="space-y-2">
          <h3 className="text-sm font-medium text-muted">{g.categoria}</h3>
          {g.needs.map((n) => (
            <details key={n.id} className="rounded-xl border border-line px-3 py-2">
              <summary className="cursor-pointer select-none font-medium">
                {n.nome} <span className="font-normal text-muted">· {pledgesDaNeed(pledges, n.id).length} pessoa(s)</span>
              </summary>
              <ul className="mt-2 divide-y divide-line">
                {pledgesDaNeed(pledges, n.id).map((p) => {
                  const u = usuarios.get(p.uid)
                  const motivoBloq = bloqueados.get(p.uid)
                  return (
                    <li key={p.id} className="space-y-2 py-2 text-sm">
                      <div>
                        <p className="font-medium">
                          {descreverPledge(p)}
                          {p.devolverAoFinal && <span className="font-normal text-muted"> · devolver no final</span>}
                        </p>
                        <p className="text-muted">
                          {u?.email || 'e-mail indisponível'}
                          {motivoBloq !== undefined && <span className="text-gdg-red"> · bloqueada{motivoBloq && `: ${motivoBloq}`}</span>}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {confirmar === p.id ? (
                          <>
                            <button type="button" className="btn-danger" disabled={ocupado} onClick={() => remover(p)}>
                              Confirmar remoção
                            </button>
                            <button type="button" className="btn-ghost" onClick={() => setConfirmar(null)}>
                              Voltar
                            </button>
                          </>
                        ) : (
                          <button type="button" className="btn-ghost" onClick={() => setConfirmar(p.id)}>
                            Remover contribuição
                          </button>
                        )}
                        {motivoBloq !== undefined ? (
                          <button
                            type="button"
                            className="btn-ghost"
                            disabled={ocupado}
                            onClick={() => rodar(() => desbloquearUsuario(db, p.uid))}
                          >
                            Desbloquear
                          </button>
                        ) : bloqueando === p.uid ? (
                          <form
                            className="flex flex-wrap gap-2"
                            onSubmit={(e) => {
                              e.preventDefault()
                              void rodar(() => bloquearUsuario(db, p.uid, motivo))
                            }}
                          >
                            <input
                              aria-label="Motivo do bloqueio"
                              className="min-h-11 rounded-xl border border-line px-3"
                              placeholder="Motivo (opcional)"
                              maxLength={200}
                              value={motivo}
                              onChange={(e) => setMotivo(e.target.value)}
                            />
                            <button type="submit" className="btn-danger" disabled={ocupado}>
                              Bloquear
                            </button>
                            <button type="button" className="btn-ghost" onClick={() => setBloqueando(null)}>
                              Voltar
                            </button>
                          </form>
                        ) : (
                          <button type="button" className="btn-ghost" onClick={() => setBloqueando(p.uid)}>
                            Bloquear pessoa
                          </button>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </details>
          ))}
        </div>
      ))}

      {bloqueios.length > 0 && (
        <div className="space-y-1 border-t border-line pt-3">
          <h3 className="text-sm font-medium">Bloqueadas ({bloqueios.length})</h3>
          <ul className="space-y-1 text-sm">
            {bloqueios.map((b) => (
              <li key={b.uid} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {usuarios.get(b.uid)?.email || b.uid}
                  {b.motivo && <span className="text-muted"> — {b.motivo}</span>}
                </span>
                <button type="button" className="btn-ghost !min-h-9" disabled={ocupado} onClick={() => rodar(() => desbloquearUsuario(db, b.uid))}>
                  Desbloquear
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
