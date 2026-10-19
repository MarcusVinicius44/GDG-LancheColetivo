import { useMemo, useState } from 'react'
import { ProgressBar } from '@/components/ProgressBar'
import { db } from '@/config/firebase'
import { mensagemErroAdmin } from '@/lib/errors'
import { planoMover } from '@/lib/needDoc'
import { motivoNaoRemover } from '@/lib/needForm'
import { aplicarOrdem, removerNeed } from '@/lib/needs'
import { agruparPorCategoria } from '@/lib/needView'
import type { Evento, Need, Pledge } from '@/lib/types'
import { NeedFormDialog } from '@/pages/admin/itens/NeedFormDialog'

interface Props {
  evento: Evento
  needs: Need[]
  pledges: Pledge[]
}

/** Item aberto no formulário: um existente, ou um novo numa categoria. */
type Aberto = { tipo: 'editar'; id: string } | { tipo: 'novo'; categoria: string }

export function ItensTab({ evento, needs, pledges }: Props) {
  const [aberto, setAberto] = useState<Aberto | null>(null)
  const [confirmarRemover, setConfirmarRemover] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // todas as categorias do evento (mesmo vazias, para poder criar item nelas); órfãs vão no fim
  const grupos = useMemo(() => {
    const cheias = new Map(agruparPorCategoria(needs, evento.categorias).map((g) => [g.categoria, g.needs]))
    const orfas = [...cheias.keys()].filter((c) => !evento.categorias.includes(c))
    return [...evento.categorias, ...orfas].map((categoria) => ({
      categoria,
      orfa: !evento.categorias.includes(categoria),
      needs: cheias.get(categoria) ?? [],
    }))
  }, [needs, evento.categorias])

  const pessoasPorNeed = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of pledges) m.set(p.needId, (m.get(p.needId) ?? 0) + 1)
    return m
  }, [pledges])

  async function rodar(fn: () => Promise<unknown>) {
    setOcupado(true)
    setErro(null)
    try {
      await fn()
      setConfirmarRemover(null)
    } catch (e) {
      setErro(mensagemErroAdmin(e))
    } finally {
      setOcupado(false)
    }
  }

  const editando = aberto?.tipo === 'editar' ? (needs.find((n) => n.id === aberto.id) ?? null) : null

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        {needs.length} item(ns) em {evento.categorias.length} categoria(s). As mudanças aparecem na hora para todo mundo.
      </p>

      {erro && (
        <p role="alert" className="card text-sm text-gdg-red">
          {erro}
        </p>
      )}

      {grupos.map((g) => (
        <section key={g.categoria} className="card space-y-3" aria-label={`Categoria ${g.categoria}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-medium">
              {g.categoria} <span className="text-sm font-normal text-muted">({g.needs.length})</span>
            </h2>
            {!g.orfa && (
              <button type="button" className="btn-ghost" onClick={() => setAberto({ tipo: 'novo', categoria: g.categoria })}>
                + Novo item
              </button>
            )}
          </div>

          {g.orfa && (
            <p className="rounded-xl bg-gdg-yellow/20 p-3 text-sm">
              Esta categoria não existe mais neste evento. Abra cada item e escolha outra categoria.
            </p>
          )}
          {g.needs.length === 0 && !g.orfa && <p className="text-sm text-muted">Nenhum item nesta categoria ainda.</p>}

          <ul className="divide-y divide-line">
            {g.needs.map((n, i) => {
              const motivo = motivoNaoRemover(n)
              const pessoas = pessoasPorNeed.get(n.id) ?? 0
              return (
                <li key={n.id} className="space-y-2 py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium">{n.nome}</p>
                      <p className="text-sm text-muted">
                        {n.unidade} · meta {n.meta} · reservado {n.reservado}
                        {pessoas > 0 && ` (${pessoas} pessoa${pessoas > 1 ? 's' : ''})`}
                        {n.opcoes.length > 0 && ` · ${n.opcoes.length} sabor(es)`}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        className="btn-ghost !min-h-9 !px-3"
                        aria-label={`Subir ${n.nome}`}
                        disabled={ocupado || i === 0}
                        onClick={() => rodar(() => aplicarOrdem(db, evento.id, planoMover(g.needs, n.id, -1)))}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="btn-ghost !min-h-9 !px-3"
                        aria-label={`Descer ${n.nome}`}
                        disabled={ocupado || i === g.needs.length - 1}
                        onClick={() => rodar(() => aplicarOrdem(db, evento.id, planoMover(g.needs, n.id, 1)))}
                      >
                        ↓
                      </button>
                      <button type="button" className="btn-primary !min-h-9" onClick={() => setAberto({ tipo: 'editar', id: n.id })}>
                        Editar
                      </button>
                    </div>
                  </div>

                  <ProgressBar valor={n.reservado} meta={n.meta} rotulo={`Progresso de ${n.nome}`} />

                  {confirmarRemover === n.id ? (
                    <div className="flex flex-wrap items-center gap-2 rounded-xl bg-gdg-red/5 p-3 text-sm">
                      <span className="flex-1">Remover “{n.nome}”? Isso não pode ser desfeito.</span>
                      <button type="button" className="btn-danger !min-h-9" disabled={ocupado} onClick={() => rodar(() => removerNeed(db, evento.id, n.id))}>
                        Sim, remover
                      </button>
                      <button type="button" className="btn-ghost !min-h-9" onClick={() => setConfirmarRemover(null)}>
                        Não
                      </button>
                    </div>
                  ) : motivo ? (
                    <p className="text-xs text-muted">🔒 Não dá para remover: {motivo}</p>
                  ) : (
                    <button type="button" className="text-sm text-gdg-red underline" onClick={() => setConfirmarRemover(n.id)}>
                      Remover item
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      ))}

      {aberto && (aberto.tipo === 'novo' || editando) && (
        <NeedFormDialog
          // recria o formulário ao trocar de item
          key={aberto.tipo === 'editar' ? aberto.id : `novo-${aberto.categoria}`}
          eventId={evento.id}
          categorias={evento.categorias}
          needs={needs}
          pledges={pledges}
          need={editando}
          categoriaInicial={aberto.tipo === 'novo' ? aberto.categoria : (editando?.categoria ?? evento.categorias[0] ?? '')}
          onClose={() => setAberto(null)}
        />
      )}
    </div>
  )
}
