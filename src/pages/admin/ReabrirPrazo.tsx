import { useState } from 'react'
import { db } from '@/config/firebase'
import { validarReabertura } from '@/lib/exportar'
import { reabrirPrazo } from '@/lib/eventos'
import { deInputFortaleza, formatDataHora, paraInputFortaleza } from '@/lib/format'
import { faseDoEvento } from '@/lib/pledgeLogic'
import type { Evento } from '@/lib/types'

const HORA = 3600_000

export function ReabrirPrazo({ evento, agora }: { evento: Evento; agora: Date }) {
  const posPrazo = faseDoEvento(evento, agora) === 'pos-prazo'
  // sugestão: 24h à frente, sem passar do início
  const sugestao = new Date(Math.min(agora.getTime() + 24 * HORA, evento.inicio.getTime()))
  const [valor, setValor] = useState(() => paraInputFortaleza(posPrazo ? sugestao : evento.prazoContribuicoes))
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const [salvando, setSalvando] = useState(false)

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    const r = validarReabertura(evento, deInputFortaleza(valor), new Date())
    if (!r.ok) return setMsg({ tipo: 'erro', texto: r.motivo })
    setSalvando(true)
    try {
      await reabrirPrazo(db, evento.id, r.prazo)
      setMsg({ tipo: 'ok', texto: `Prazo atualizado para ${formatDataHora(r.prazo)}.` })
    } catch {
      setMsg({ tipo: 'erro', texto: 'Não foi possível atualizar o prazo. Confira se você é admin e tente de novo.' })
    } finally {
      setSalvando(false)
    }
  }

  return (
    <form onSubmit={salvar} className="space-y-2" aria-labelledby="reabrir-t">
      <h3 id="reabrir-t" className="font-medium">
        {posPrazo ? 'Reabrir contribuições até…' : 'Prazo das contribuições'}
      </h3>
      <p className="text-sm text-muted">
        Prazo atual: {formatDataHora(evento.prazoContribuicoes)}. O novo prazo não pode passar do início do evento (
        {formatDataHora(evento.inicio)}). Horário de Fortaleza.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="datetime-local"
          aria-label="Novo prazo"
          className="min-h-11 rounded-xl border border-line px-3"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
        />
        <button type="submit" className="btn-primary" disabled={salvando}>
          {salvando ? 'Salvando…' : posPrazo ? 'Reabrir' : 'Alterar prazo'}
        </button>
      </div>
      {msg && (
        <p role={msg.tipo === 'erro' ? 'alert' : 'status'} className={`text-sm ${msg.tipo === 'erro' ? 'text-gdg-red' : 'text-gdg-green'}`}>
          {msg.texto}
        </p>
      )}
    </form>
  )
}
