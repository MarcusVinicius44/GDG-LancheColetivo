import { useState } from 'react'
import { db } from '@/config/firebase'
import { MAX_CATEGORIAS, MAX_NOME_CATEGORIA } from '@/config/constants'
import { adicionarCategoria, moverCategoria, removerCategoria, renomearCategoria } from '@/lib/categorias'
import { itensDaCategoria, motivoNaoRemoverCategoria, validarNomeCategoria } from '@/lib/categoriasLogic'
import { mensagemErroAdmin } from '@/lib/errors'
import type { Evento, Need } from '@/lib/types'

interface Props {
  evento: Evento
  needs: Need[]
}

export function CategoriasTab({ evento, needs }: Props) {
  const [novo, setNovo] = useState('')
  const [renomeando, setRenomeando] = useState<{ de: string; para: string } | null>(null)
  const [confirmarRemover, setConfirmarRemover] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  const lista = evento.categorias
  const erroNovo = novo.trim() === '' ? null : validarNomeCategoria(novo, lista)
  const erroRenomear = renomeando ? validarNomeCategoria(renomeando.para, lista, renomeando.de) : null

  async function rodar(fn: () => Promise<unknown>, sucesso?: string) {
    setOcupado(true)
    setErro(null)
    setOk(null)
    try {
      await fn()
      setOk(sucesso ?? null)
      setConfirmarRemover(null)
    } catch (e) {
      setErro(mensagemErroAdmin(e))
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        As categorias são os tópicos da lista (Bebidas, Salgados…). A ordem aqui é a ordem na página do evento. Até{' '}
        {MAX_CATEGORIAS} categorias.
      </p>

      {erro && (
        <p role="alert" className="card text-sm text-gdg-red">
          {erro}
        </p>
      )}
      {ok && (
        <p role="status" className="card text-sm text-gdg-green">
          {ok}
        </p>
      )}

      <section className="card space-y-3" aria-label="Categorias do evento">
        <ul className="divide-y divide-line">
          {lista.map((c, i) => {
            const qtd = itensDaCategoria(needs, c).length
            const motivo = motivoNaoRemoverCategoria(needs, c, lista.length)
            const editando = renomeando?.de === c
            return (
              <li key={c} className="space-y-2 py-3 first:pt-0 last:pb-0">
                {editando ? (
                  <form
                    className="space-y-2"
                    onSubmit={(e) => {
                      e.preventDefault()
                      if (erroRenomear || !renomeando) return
                      const { de, para } = renomeando
                      void rodar(async () => {
                        await renomearCategoria(db, evento.id, de, para, needs)
                        setRenomeando(null)
                      }, `Categoria renomeada para “${para.trim()}”.`)
                    }}
                  >
                    <label htmlFor="cat-renomear" className="text-sm font-medium">
                      Novo nome de “{c}”
                    </label>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        id="cat-renomear"
                        autoFocus
                        className="min-h-11 min-w-0 flex-1 rounded-xl border border-line px-3 aria-[invalid=true]:border-gdg-red"
                        aria-invalid={Boolean(erroRenomear)}
                        value={renomeando.para}
                        maxLength={MAX_NOME_CATEGORIA + 5}
                        onChange={(e) => setRenomeando({ de: c, para: e.target.value })}
                      />
                      <button type="submit" className="btn-primary" disabled={ocupado || Boolean(erroRenomear) || renomeando.para.trim() === c}>
                        {ocupado ? 'Renomeando…' : 'Renomear'}
                      </button>
                      <button type="button" className="btn-ghost" onClick={() => setRenomeando(null)} disabled={ocupado}>
                        Cancelar
                      </button>
                    </div>
                    {erroRenomear && (
                      <p role="alert" className="text-sm text-gdg-red">
                        {erroRenomear}
                      </p>
                    )}
                    {qtd > 0 && <p className="text-xs text-muted">Os {qtd} item(ns) desta categoria vão junto.</p>}
                  </form>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{c}</p>
                      <p className="text-sm text-muted">{qtd} item(ns)</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        className="btn-ghost !min-h-9 !px-3"
                        aria-label={`Subir ${c}`}
                        disabled={ocupado || i === 0}
                        onClick={() => rodar(() => moverCategoria(db, evento.id, c, -1))}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="btn-ghost !min-h-9 !px-3"
                        aria-label={`Descer ${c}`}
                        disabled={ocupado || i === lista.length - 1}
                        onClick={() => rodar(() => moverCategoria(db, evento.id, c, 1))}
                      >
                        ↓
                      </button>
                      <button type="button" className="btn-ghost !min-h-9" disabled={ocupado} onClick={() => setRenomeando({ de: c, para: c })}>
                        Renomear
                      </button>
                    </div>
                  </div>
                )}

                {!editando &&
                  (confirmarRemover === c ? (
                    <div className="flex flex-wrap items-center gap-2 rounded-xl bg-gdg-red/5 p-3 text-sm">
                      <span className="flex-1">Remover a categoria “{c}”?</span>
                      <button
                        type="button"
                        className="btn-danger !min-h-9"
                        disabled={ocupado}
                        onClick={() => rodar(() => removerCategoria(db, evento.id, c), `Categoria “${c}” removida.`)}
                      >
                        Sim, remover
                      </button>
                      <button type="button" className="btn-ghost !min-h-9" onClick={() => setConfirmarRemover(null)}>
                        Não
                      </button>
                    </div>
                  ) : motivo ? (
                    <p className="text-xs text-muted">🔒 Não dá para remover: {motivo}</p>
                  ) : (
                    <button type="button" className="text-sm text-gdg-red underline" onClick={() => setConfirmarRemover(c)}>
                      Remover categoria
                    </button>
                  ))}
              </li>
            )
          })}
        </ul>
      </section>

      <form
        className="card space-y-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (!novo.trim() || erroNovo) return
          const nome = novo.trim()
          void rodar(async () => {
            await adicionarCategoria(db, evento.id, nome)
            setNovo('')
          }, `Categoria “${nome}” criada. Agora crie itens nela na aba Itens.`)
        }}
      >
        <label htmlFor="cat-nova" className="text-sm font-medium">
          Nova categoria
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <input
            id="cat-nova"
            className="min-h-11 min-w-0 flex-1 rounded-xl border border-line px-3 aria-[invalid=true]:border-gdg-red"
            aria-invalid={Boolean(erroNovo)}
            placeholder="Ex.: Frutas"
            value={novo}
            maxLength={MAX_NOME_CATEGORIA + 5}
            disabled={lista.length >= MAX_CATEGORIAS}
            onChange={(e) => setNovo(e.target.value)}
          />
          <button type="submit" className="btn-primary" disabled={ocupado || !novo.trim() || Boolean(erroNovo) || lista.length >= MAX_CATEGORIAS}>
            Adicionar
          </button>
        </div>
        {erroNovo && (
          <p role="alert" className="text-sm text-gdg-red">
            {erroNovo}
          </p>
        )}
        {lista.length >= MAX_CATEGORIAS && <p className="text-sm text-muted">Limite de {MAX_CATEGORIAS} categorias atingido.</p>}
      </form>
    </div>
  )
}
