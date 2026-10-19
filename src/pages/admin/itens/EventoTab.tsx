import { useState } from 'react'
import { Campo, CLASSE_CONTROLE } from '@/components/Campo'
import { db } from '@/config/firebase'
import { mensagemErroAdmin } from '@/lib/errors'
import {
  camposEventoAlterados,
  LIMITES_EVENTO,
  paraEventoBase,
  temErrosEvento,
  validarEvento,
  type EventoForm,
} from '@/lib/eventoForm'
import { salvarEvento } from '@/lib/eventos'
import { deInputFortaleza, paraInputFortaleza } from '@/lib/format'
import type { Evento, Pledge } from '@/lib/types'

interface Props {
  evento: Evento
  pledges: Pledge[]
  agora: Date
}

const numero = (s: string): number | null => (s.trim() === '' ? null : Number(s.trim()))

export function EventoTab({ evento, pledges, agora }: Props) {
  const [t, setT] = useState(() => ({
    titulo: evento.titulo,
    descricao: evento.descricao,
    local: evento.local,
    inicio: paraInputFortaleza(evento.inicio),
    prazo: paraInputFortaleza(evento.prazoContribuicoes),
    inscritos: String(evento.inscritos),
    publico: String(evento.publicoPlanejado),
    maxItens: String(evento.maxNecessidadesPorPessoa),
  }))
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  const form: EventoForm = {
    titulo: t.titulo,
    descricao: t.descricao,
    local: t.local,
    inicio: deInputFortaleza(t.inicio),
    prazoContribuicoes: deInputFortaleza(t.prazo),
    inscritos: numero(t.inscritos),
    publicoPlanejado: numero(t.publico),
    maxNecessidadesPorPessoa: numero(t.maxItens),
  }
  const { erros, avisos } = validarEvento(form, agora, pledges)
  const set = (k: keyof typeof t, v: string) => {
    setMsg(null)
    setT((x) => ({ ...x, [k]: v }))
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    const base = temErrosEvento(erros) ? null : paraEventoBase(form)
    if (!base) return setMsg({ tipo: 'erro', texto: 'Corrija os campos destacados para salvar.' })
    const campos = camposEventoAlterados(evento, base)
    if (Object.keys(campos).length === 0) return setMsg({ tipo: 'ok', texto: 'Nada mudou.' })
    setSalvando(true)
    setMsg(null)
    try {
      await salvarEvento(db, evento.id, campos)
      setMsg({ tipo: 'ok', texto: 'Dados do evento salvos.' })
    } catch (err) {
      setMsg({ tipo: 'erro', texto: mensagemErroAdmin(err) })
    } finally {
      setSalvando(false)
    }
  }

  return (
    <form onSubmit={salvar} noValidate className="card space-y-4">
      <p className="text-sm text-muted">Horários no fuso de Fortaleza. O prazo não pode passar do início do evento.</p>

      <Campo rotulo="Título" erro={erros.titulo}>
        {(a) => <input {...a} className={CLASSE_CONTROLE} value={t.titulo} maxLength={LIMITES_EVENTO.titulo + 10} onChange={(e) => set('titulo', e.target.value)} />}
      </Campo>

      <Campo rotulo="Descrição" erro={erros.descricao}>
        {(a) => (
          <textarea
            {...a}
            rows={4}
            className="w-full rounded-xl border border-line px-3 py-2 aria-[invalid=true]:border-gdg-red"
            value={t.descricao}
            onChange={(e) => set('descricao', e.target.value)}
          />
        )}
      </Campo>

      <Campo rotulo="Local" erro={erros.local}>
        {(a) => <input {...a} className={CLASSE_CONTROLE} value={t.local} onChange={(e) => set('local', e.target.value)} />}
      </Campo>

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo rotulo="Início do evento" erro={erros.inicio}>
          {(a) => <input {...a} type="datetime-local" className={CLASSE_CONTROLE} value={t.inicio} onChange={(e) => set('inicio', e.target.value)} />}
        </Campo>
        <Campo rotulo="Prazo das contribuições" erro={erros.prazoContribuicoes}>
          {(a) => <input {...a} type="datetime-local" className={CLASSE_CONTROLE} value={t.prazo} onChange={(e) => set('prazo', e.target.value)} />}
        </Campo>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Campo rotulo="Inscritos" ajuda="Só informativo." erro={erros.inscritos}>
          {(a) => <input {...a} inputMode="numeric" className={CLASSE_CONTROLE} value={t.inscritos} onChange={(e) => set('inscritos', e.target.value)} />}
        </Campo>
        <Campo rotulo="Público planejado" ajuda="Base das metas." erro={erros.publicoPlanejado}>
          {(a) => <input {...a} inputMode="numeric" className={CLASSE_CONTROLE} value={t.publico} onChange={(e) => set('publico', e.target.value)} />}
        </Campo>
        <Campo rotulo="Itens por pessoa" ajuda="Máximo de itens diferentes." erro={erros.maxNecessidadesPorPessoa}>
          {(a) => <input {...a} inputMode="numeric" className={CLASSE_CONTROLE} value={t.maxItens} onChange={(e) => set('maxItens', e.target.value)} />}
        </Campo>
      </div>

      {avisos.length > 0 && (
        <ul className="space-y-1 rounded-xl bg-gdg-yellow/20 p-3 text-sm">
          {avisos.map((a) => (
            <li key={a}>⚠️ {a}</li>
          ))}
        </ul>
      )}

      {msg && (
        <p role={msg.tipo === 'erro' ? 'alert' : 'status'} className={`text-sm ${msg.tipo === 'erro' ? 'text-gdg-red' : 'text-gdg-green'}`}>
          {msg.texto}
        </p>
      )}

      <button type="submit" className="btn-primary" disabled={salvando}>
        {salvando ? 'Salvando…' : 'Salvar dados do evento'}
      </button>
    </form>
  )
}
