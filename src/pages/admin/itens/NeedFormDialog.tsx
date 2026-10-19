import { useEffect, useMemo, useRef, useState } from 'react'
import { Campo, CLASSE_CONTROLE } from '@/components/Campo'
import { db } from '@/config/firebase'
import { MAX_OPCOES, ROTULO_TAG, TAGS, type Tag } from '@/config/constants'
import { mensagemErroAdmin } from '@/lib/errors'
import {
  formDe,
  formVazio,
  paraBase,
  temErros,
  validarNeed,
  type CampoNeed,
  type NeedForm,
} from '@/lib/needForm'
import { criarNeed, salvarNeed } from '@/lib/needs'
import type { Need, Pledge } from '@/lib/types'

interface Props {
  eventId: string
  categorias: readonly string[]
  /** Todos os itens do evento (para nomes repetidos e `ordem`). */
  needs: Need[]
  /** Todas as contribuições do evento (as do item são filtradas aqui). */
  pledges: Pledge[]
  /** Item em edição; `null` = item novo. */
  need: Need | null
  /** Categoria pré-selecionada num item novo. */
  categoriaInicial: string
  onClose: () => void
}

/** Campos numéricos digitados como texto (vazio e inválido precisam ser distinguíveis). */
interface Texto {
  meta: string
  minPorPessoa: string
  maxPorPessoa: string
  maxPorOpcao: string
}

const aTexto = (f: NeedForm): Texto => ({
  meta: f.meta === null ? '' : String(f.meta),
  minPorPessoa: f.minPorPessoa === null ? '' : String(f.minPorPessoa),
  maxPorPessoa: f.maxPorPessoa === null ? '' : String(f.maxPorPessoa),
  maxPorOpcao: f.maxPorOpcao === null ? '' : String(f.maxPorOpcao),
})

/** '' ⇒ `null`; texto que não é número ⇒ `NaN` (o validador avisa). */
const numero = (s: string): number | null => (s.trim() === '' ? null : Number(s.trim()))

export function NeedFormDialog({ eventId, categorias, needs, pledges, need, categoriaInicial, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const inicial = useMemo(() => (need ? formDe(need) : formVazio(categoriaInicial)), [need, categoriaInicial])
  const [form, setForm] = useState<NeedForm>(inicial)
  const [texto, setTexto] = useState<Texto>(() => aTexto(inicial))
  const [tentou, setTentou] = useState(false)
  const [tocados, setTocados] = useState<ReadonlySet<CampoNeed>>(new Set())
  const [salvando, setSalvando] = useState(false)
  const [erroServidor, setErroServidor] = useState<string | null>(null)

  useEffect(() => {
    const d = ref.current
    if (d && !d.open) d.showModal()
  }, [])

  const dele = useMemo(() => (need ? pledges.filter((p) => p.needId === need.id) : []), [need, pledges])
  const comReservas = (need?.reservado ?? 0) > 0
  const nSaboresTravados = comReservas ? (need?.opcoes.length ?? 0) : 0

  const efetivo: NeedForm = { ...form, meta: numero(texto.meta), minPorPessoa: numero(texto.minPorPessoa), maxPorPessoa: numero(texto.maxPorPessoa), maxPorOpcao: numero(texto.maxPorOpcao) }
  const erros = validarNeed(efetivo, {
    atual: need,
    pledges: dele,
    categorias,
    outrosNomes: needs.filter((n) => n.id !== need?.id).map((n) => n.nome),
  })
  const mostra = (c: CampoNeed) => (tentou || tocados.has(c) ? erros[c] : undefined)
  const tocar = (c: CampoNeed) => setTocados((t) => new Set(t).add(c))

  const set = <K extends keyof NeedForm>(k: K, v: NeedForm[K]) => setForm((f) => ({ ...f, [k]: v }))
  const setNum = (k: keyof Texto, v: string) => setTexto((t) => ({ ...t, [k]: v }))

  // --- sabores/marcas
  const setOpcao = (i: number, v: string) => set('opcoes', form.opcoes.map((o, j) => (j === i ? v : o)))
  const addOpcao = () => set('opcoes', [...form.opcoes, ''])
  const delOpcao = (i: number) => set('opcoes', form.opcoes.filter((_, j) => j !== i))
  const moverOpcao = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= form.opcoes.length) return
    const nova = [...form.opcoes]
    ;[nova[i], nova[j]] = [nova[j]!, nova[i]!]
    set('opcoes', nova)
  }

  const alternarTag = (t: Tag) =>
    set('tags', form.tags.includes(t) ? form.tags.filter((x) => x !== t) : [...form.tags, t])

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setTentou(true)
    setErroServidor(null)
    const base = temErros(erros) ? null : paraBase(efetivo)
    if (!base) return
    setSalvando(true)
    try {
      if (need) await salvarNeed(db, eventId, need, base)
      else await criarNeed(db, eventId, base, needs)
      onClose()
    } catch (err) {
      setErroServidor(mensagemErroAdmin(err))
    } finally {
      setSalvando(false)
    }
  }

  const campoComErro = Object.keys(erros).length
  const titulo = need ? 'Editar item' : 'Novo item'

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="need-form-t"
      className="m-auto w-[calc(100%-2rem)] max-w-xl rounded-card border border-line bg-white p-0 text-ink shadow-xl backdrop:bg-ink/40"
    >
      <form onSubmit={salvar} noValidate className="max-h-[90dvh] space-y-4 overflow-y-auto p-5">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h2 id="need-form-t" className="text-lg font-medium">
              {titulo}
            </h2>
            {need && (
              <p className="text-sm text-muted">
                {need.reservado} de {need.meta} reservado(s) · {dele.length} contribuição(ões)
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="btn-ghost !min-h-9 !px-3">
            ✕
          </button>
        </header>

        {comReservas && (
          <p className="rounded-xl bg-gdg-yellow/20 p-3 text-sm">
            Este item já tem contribuições. Para não invalidar o que as pessoas escolheram, alguns campos têm limites: a
            meta não pode ficar abaixo do reservado, os sabores existentes ficam travados (dá para acrescentar novos) e o
            mínimo/máximo por pessoa precisa continuar valendo para quem já contribuiu.
          </p>
        )}

        <Campo rotulo="Nome do item" erro={mostra('nome')}>
          {(a) => (
            <input
              {...a}
              className={CLASSE_CONTROLE}
              value={form.nome}
              maxLength={90}
              placeholder="Ex.: Refrigerante"
              onChange={(e) => set('nome', e.target.value)}
              onBlur={() => tocar('nome')}
            />
          )}
        </Campo>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Categoria" erro={mostra('categoria')}>
            {(a) => (
              <select {...a} className={CLASSE_CONTROLE} value={form.categoria} onChange={(e) => set('categoria', e.target.value)}>
                {!categorias.includes(form.categoria) && <option value={form.categoria}>{form.categoria} (não existe mais)</option>}
                {categorias.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            )}
          </Campo>
          <Campo rotulo="Unidade" ajuda="Como se conta: garrafa 2L, pacote, unidade…" erro={mostra('unidade')}>
            {(a) => (
              <input
                {...a}
                className={CLASSE_CONTROLE}
                value={form.unidade}
                maxLength={50}
                onChange={(e) => set('unidade', e.target.value)}
                onBlur={() => tocar('unidade')}
              />
            )}
          </Campo>
        </div>

        <Campo
          rotulo="Meta (quantidade necessária no total)"
          ajuda={comReservas ? `Mínimo ${need?.reservado}: é o que já está reservado.` : undefined}
          erro={mostra('meta')}
        >
          {(a) => (
            <input
              {...a}
              inputMode="numeric"
              className={`${CLASSE_CONTROLE} sm:w-40`}
              value={texto.meta}
              onChange={(e) => setNum('meta', e.target.value)}
              onBlur={() => tocar('meta')}
            />
          )}
        </Campo>

        <fieldset className="space-y-3 rounded-xl border border-line p-3">
          <legend className="px-1 text-sm font-medium">Quanto cada pessoa pode levar</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Mínimo" erro={mostra('minPorPessoa')}>
              {(a) => (
                <input
                  {...a}
                  inputMode="numeric"
                  className={CLASSE_CONTROLE}
                  value={texto.minPorPessoa}
                  onChange={(e) => setNum('minPorPessoa', e.target.value)}
                  onBlur={() => tocar('minPorPessoa')}
                />
              )}
            </Campo>
            <Campo rotulo="Máximo" erro={mostra('maxPorPessoa')}>
              {(a) => (
                <input
                  {...a}
                  inputMode="numeric"
                  className={CLASSE_CONTROLE}
                  value={texto.maxPorPessoa}
                  onChange={(e) => setNum('maxPorPessoa', e.target.value)}
                  onBlur={() => tocar('maxPorPessoa')}
                />
              )}
            </Campo>
          </div>
        </fieldset>

        <fieldset className="space-y-3 rounded-xl border border-line p-3">
          <legend className="px-1 text-sm font-medium">Sabores / marcas (opcional)</legend>
          <p className="text-xs text-muted">
            Se o item tem variações (Coca-Cola, Fanta…), liste aqui; a pessoa escolhe uma. Até {MAX_OPCOES}.
          </p>
          <ul className="space-y-2">
            {form.opcoes.map((o, i) => {
              const travada = i < nSaboresTravados
              const escolhidos = need?.reservadoPorOpcao[o] ?? 0
              return (
                <li key={i} className="flex items-center gap-2">
                  <input
                    aria-label={`Sabor ${i + 1}`}
                    className={`${CLASSE_CONTROLE} flex-1 disabled:bg-surface`}
                    value={o}
                    disabled={travada}
                    maxLength={50}
                    placeholder="Ex.: Guaraná Antarctica"
                    onChange={(e) => setOpcao(i, e.target.value)}
                  />
                  {travada ? (
                    <span className="w-24 shrink-0 text-xs text-muted">
                      🔒 {escolhidos} escolhido(s)
                    </span>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="btn-ghost !min-h-9 !px-3"
                        aria-label={`Subir sabor ${i + 1}`}
                        disabled={i === 0 || i - 1 < nSaboresTravados}
                        onClick={() => moverOpcao(i, -1)}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="btn-ghost !min-h-9 !px-3"
                        aria-label={`Descer sabor ${i + 1}`}
                        disabled={i === form.opcoes.length - 1}
                        onClick={() => moverOpcao(i, 1)}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="btn-ghost !min-h-9 !px-3 text-gdg-red"
                        aria-label={`Remover sabor ${i + 1}`}
                        onClick={() => delOpcao(i)}
                      >
                        ✕
                      </button>
                    </>
                  )}
                </li>
              )
            })}
          </ul>
          {mostra('opcoes') && (
            <p role="alert" className="text-sm text-gdg-red">
              {mostra('opcoes')}
            </p>
          )}
          <button type="button" className="btn-ghost" disabled={form.opcoes.length >= MAX_OPCOES} onClick={addOpcao}>
            + Adicionar sabor/marca
          </button>

          {form.opcoes.length > 0 && (
            <Campo
              rotulo="Limite por sabor (opcional)"
              ajuda="Máximo de unidades de cada sabor, somando todo mundo. Deixe vazio para sem limite."
              erro={mostra('maxPorOpcao')}
            >
              {(a) => (
                <input
                  {...a}
                  inputMode="numeric"
                  className={`${CLASSE_CONTROLE} sm:w-40`}
                  value={texto.maxPorOpcao}
                  onChange={(e) => setNum('maxPorOpcao', e.target.value)}
                  onBlur={() => tocar('maxPorOpcao')}
                />
              )}
            </Campo>
          )}

          <label className="flex cursor-pointer items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-gdg-blue"
              checked={form.permiteOutro}
              onChange={(e) => set('permiteOutro', e.target.checked)}
            />
            <span>
              Aceita “Outro”
              <span className="block text-xs text-muted">
                A pessoa pode escrever uma opção que não está na lista
                {form.opcoes.length === 0 ? ' (com ela, o campo vira um detalhe opcional, como “qual salgado?”)' : ''}.
              </span>
            </span>
          </label>
        </fieldset>

        <Campo rotulo="Observação (opcional)" ajuda="Aparece no cartão do item. Ex.: “A garrafa volta para você no final.”" erro={mostra('nota')}>
          {(a) => (
            <textarea
              {...a}
              rows={2}
              className="w-full rounded-xl border border-line px-3 py-2 aria-[invalid=true]:border-gdg-red"
              value={form.nota}
              maxLength={220}
              onChange={(e) => set('nota', e.target.value)}
              onBlur={() => tocar('nota')}
            />
          )}
        </Campo>

        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm font-medium">Etiquetas</legend>
          <div className="flex flex-wrap gap-2">
            {TAGS.map((t) => (
              <label
                key={t}
                className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-4 text-sm ${
                  form.tags.includes(t) ? 'border-gdg-blue bg-gdg-blue/5' : 'border-line'
                }`}
              >
                <input type="checkbox" className="size-4 accent-gdg-blue" checked={form.tags.includes(t)} onChange={() => alternarTag(t)} />
                {ROTULO_TAG[t]}
              </label>
            ))}
          </div>
          {mostra('tags') && (
            <p role="alert" className="text-sm text-gdg-red">
              {mostra('tags')}
            </p>
          )}
        </fieldset>

        {erroServidor && (
          <p role="alert" className="rounded-xl border border-gdg-red/40 bg-gdg-red/5 p-3 text-sm">
            {erroServidor}
          </p>
        )}
        {tentou && campoComErro > 0 && (
          <p role="alert" className="text-sm text-gdg-red">
            Corrija os campos destacados para salvar.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" className="btn-primary flex-1" disabled={salvando}>
            {salvando ? 'Salvando…' : need ? 'Salvar alterações' : 'Criar item'}
          </button>
          <button type="button" className="btn-ghost" onClick={onClose} disabled={salvando}>
            Cancelar
          </button>
        </div>
      </form>
    </dialog>
  )
}
