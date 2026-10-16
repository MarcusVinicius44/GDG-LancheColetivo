import { useEffect, useId, useRef, useState } from 'react'
import { PrivacyNote } from '@/components/PrivacyNote'
import { MAX_TEXTO_OUTRO } from '@/config/constants'
import { PledgeError } from '@/lib/errors'
import { norm } from '@/lib/format'
import { maxParaMim, permiteDevolver, restanteDaOpcao } from '@/lib/needView'
import type { Fase } from '@/lib/pledgeLogic'
import type { Need, Pledge, PledgeInput } from '@/lib/types'

const OUTRO = '#outro'

interface Props {
  need: Need
  /** pledge atual da pessoa nesta necessidade (edição) ou `null` (nova). */
  minha: Pledge | null
  fase: Fase
  onClose: () => void
  onSalvar: (input: PledgeInput) => Promise<void>
  onCancelar: () => Promise<void>
}

export function PledgeModal({ need, minha, fase, onClose, onSalvar, onCancelar }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const uid = useId()
  const posPrazo = fase === 'pos-prazo'
  const temOpcoes = need.opcoes.length > 0

  const [escolha, setEscolha] = useState<string>(() =>
    minha?.opcao ?? (minha?.textoOutro && temOpcoes ? OUTRO : ''),
  )
  const [texto, setTexto] = useState(minha?.textoOutro ?? '')
  const [qtyBruta, setQtyBruta] = useState(minha?.qty ?? need.minPorPessoa)
  const [devolver, setDevolver] = useState(minha?.devolverAoFinal ?? false)
  const [pendente, setPendente] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [erro, setErro] = useState<PledgeError | null>(null)

  useEffect(() => {
    const d = ref.current
    if (d && !d.open) d.showModal()
  }, [])

  const opcaoSel = escolha && escolha !== OUTRO ? escolha : null
  // pós-prazo só reduz: nunca passa da quantidade atual
  const max = posPrazo ? Math.min(maxParaMim(need, minha, opcaoSel), minha?.qty ?? 0) : maxParaMim(need, minha, opcaoSel)
  const min = Math.min(need.minPorPessoa, Math.max(max, 1))
  const qty = Math.max(Math.min(qtyBruta, max), min)

  const textoLimpo = texto.trim()
  const duplicada =
    escolha === OUTRO && textoLimpo !== '' ? need.opcoes[need.opcoesNorm.indexOf(norm(textoLimpo))] : undefined
  const escolhaOk = !temOpcoes || (escolha === OUTRO ? textoLimpo !== '' && !duplicada : escolha !== '')
  const podeSalvar = escolhaOk && max >= need.minPorPessoa && !pendente

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!podeSalvar) return
    setPendente(true)
    setErro(null)
    try {
      await onSalvar({
        qty,
        opcao: opcaoSel,
        textoOutro: escolha === OUTRO || (!temOpcoes && need.permiteOutro) ? textoLimpo || null : null,
        devolverAoFinal: devolver,
      })
      onClose()
    } catch (err) {
      setErro(err instanceof PledgeError ? err : new PledgeError('desconhecido', 'Algo deu errado. Tente de novo.'))
    } finally {
      setPendente(false)
    }
  }

  async function cancelar() {
    setPendente(true)
    setErro(null)
    try {
      await onCancelar()
      onClose()
    } catch (err) {
      setErro(err instanceof PledgeError ? err : new PledgeError('desconhecido', 'Algo deu errado. Tente de novo.'))
      setConfirmando(false)
    } finally {
      setPendente(false)
    }
  }

  const titulo = minha ? (posPrazo ? 'Reduzir minha parte' : 'Editar minha parte') : 'Quero levar'

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby={`${uid}-t`}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-card border border-line bg-white p-0 text-ink shadow-xl backdrop:bg-ink/40"
    >
      <form onSubmit={salvar} className="max-h-[85dvh] space-y-4 overflow-y-auto p-5">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h2 id={`${uid}-t`} className="text-lg font-medium">
              {titulo}
            </h2>
            <p className="text-sm text-muted">
              {need.nome} · {need.unidade}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="btn-ghost !min-h-9 !px-3">
            ✕
          </button>
        </header>

        {posPrazo && (
          <p className="rounded-xl bg-gdg-yellow/20 p-3 text-sm">
            O prazo terminou: agora só dá para <strong>reduzir</strong> a quantidade ou cancelar. A organização é
            avisada.
          </p>
        )}

        {temOpcoes && (
          <fieldset className="space-y-2" disabled={posPrazo}>
            <legend className="mb-1 text-sm font-medium">Qual opção você leva?</legend>
            {need.opcoes.map((o) => {
              const sobra = restanteDaOpcao(need, o)
              const minhaNela = minha?.opcao === o ? minha.qty : 0
              const cheia = sobra !== null && sobra + minhaNela <= 0
              return (
                <label
                  key={o}
                  className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3 ${
                    escolha === o ? 'border-gdg-blue bg-gdg-blue/5' : 'border-line'
                  } ${cheia && escolha !== o ? 'cursor-not-allowed opacity-50' : ''}`}
                >
                  <input
                    type="radio"
                    name={`${uid}-op`}
                    className="size-4 accent-gdg-blue"
                    checked={escolha === o}
                    disabled={cheia && escolha !== o}
                    onChange={() => setEscolha(o)}
                  />
                  <span className="flex-1">{o}</span>
                  {sobra !== null && (
                    <span className="text-xs text-muted">{cheia ? 'completo' : `faltam ${sobra + minhaNela}`}</span>
                  )}
                </label>
              )
            })}
            {need.permiteOutro && (
              <label
                className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3 ${
                  escolha === OUTRO ? 'border-gdg-blue bg-gdg-blue/5' : 'border-line'
                }`}
              >
                <input
                  type="radio"
                  name={`${uid}-op`}
                  className="size-4 accent-gdg-blue"
                  checked={escolha === OUTRO}
                  onChange={() => setEscolha(OUTRO)}
                />
                <span className="flex-1">Outro</span>
              </label>
            )}
          </fieldset>
        )}

        {((temOpcoes && escolha === OUTRO) || (!temOpcoes && need.permiteOutro)) && (
          <div className="space-y-1">
            <label htmlFor={`${uid}-tx`} className="text-sm font-medium">
              {temOpcoes ? 'Qual?' : 'Detalhe (opcional)'}
            </label>
            <input
              id={`${uid}-tx`}
              className="min-h-11 w-full rounded-xl border border-line px-3"
              value={texto}
              maxLength={MAX_TEXTO_OUTRO}
              disabled={posPrazo}
              placeholder={temOpcoes ? 'Ex.: Sprite' : 'Ex.: coxinha, esfiha…'}
              onChange={(e) => setTexto(e.target.value)}
            />
            {duplicada && (
              <p role="alert" className="text-sm text-gdg-red">
                Já existe a opção “{duplicada}”.{' '}
                <button type="button" className="underline" onClick={() => setEscolha(duplicada)}>
                  Selecionar “{duplicada}”
                </button>
              </p>
            )}
          </div>
        )}

        <div className="space-y-1">
          <label htmlFor={`${uid}-q`} className="text-sm font-medium">
            Quantidade <span className="font-normal text-muted">({need.unidade})</span>
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn-ghost !px-0 w-11"
              aria-label="Diminuir"
              disabled={qty <= min}
              onClick={() => setQtyBruta(Math.max(qty - 1, min))}
            >
              −
            </button>
            <input
              id={`${uid}-q`}
              type="number"
              inputMode="numeric"
              min={min}
              max={max}
              step={1}
              className="min-h-11 w-24 rounded-xl border border-line text-center text-lg"
              value={qty}
              onChange={(e) => setQtyBruta(Math.trunc(Number(e.target.value)) || min)}
            />
            <button
              type="button"
              className="btn-ghost !px-0 w-11"
              aria-label="Aumentar"
              disabled={qty >= max}
              onClick={() => setQtyBruta(Math.min(qty + 1, max))}
            >
              +
            </button>
          </div>
          <p className="text-xs text-muted">
            {max < need.minPorPessoa
              ? 'Não há mais unidades disponíveis para você neste item.'
              : `Mínimo ${need.minPorPessoa} · máximo ${max} para você agora.`}
          </p>
        </div>

        {permiteDevolver(need) && (
          <label className="flex cursor-pointer items-center gap-3 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-gdg-blue"
              checked={devolver}
              onChange={(e) => setDevolver(e.target.checked)}
            />
            Quero levar de volta no final (ex.: garrafa térmica, faca)
          </label>
        )}

        {erro && (
          <div role="alert" className="rounded-xl border border-gdg-red/40 bg-gdg-red/5 p-3 text-sm">
            <p>{erro.message}</p>
            {erro.code === 'esgotado' && typeof erro.detalhe === 'number' && (
              <p className="mt-1 text-muted">
                {erro.detalhe > 0 ? `Ainda cabem ${erro.detalhe}. Ajuste a quantidade.` : 'Não sobrou nada neste item.'}
              </p>
            )}
            {erro.code === 'outro-duplicado' && typeof erro.detalhe === 'string' && (
              <button type="button" className="mt-1 underline" onClick={() => setEscolha(erro.detalhe as string)}>
                Selecionar “{erro.detalhe}”
              </button>
            )}
            {erro.podeTentarDeNovo && <p className="mt-1 text-muted">Toque em “Salvar” para tentar de novo.</p>}
          </div>
        )}

        <PrivacyNote />

        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" className="btn-primary flex-1" disabled={!podeSalvar}>
            {pendente ? 'Salvando…' : minha ? 'Salvar' : 'Confirmar'}
          </button>
          {minha &&
            (confirmando ? (
              <>
                <button type="button" className="btn-danger" disabled={pendente} onClick={cancelar}>
                  Sim, cancelar
                </button>
                <button type="button" className="btn-ghost" onClick={() => setConfirmando(false)}>
                  Não
                </button>
              </>
            ) : (
              <button type="button" className="btn-ghost text-gdg-red" disabled={pendente} onClick={() => setConfirmando(true)}>
                Cancelar contribuição
              </button>
            ))}
        </div>
      </form>
    </dialog>
  )
}
