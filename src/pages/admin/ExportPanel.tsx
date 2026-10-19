import { useState } from 'react'
import { gerarCsv, textoFalta, textoQuemLeva, type Usuario } from '@/lib/exportar'
import type { Evento, Need, Pledge } from '@/lib/types'

interface Props {
  evento: Evento
  needs: Need[]
  pledges: Pledge[]
  usuarios: Map<string, Usuario>
}

type Texto = 'quem' | 'falta'

export function ExportPanel({ evento, needs, pledges, usuarios }: Props) {
  const [aberto, setAberto] = useState<Texto>('quem')
  const [copiado, setCopiado] = useState<Texto | null>(null)

  const link = `${window.location.origin}/e/${evento.id}`
  const textos: Record<Texto, string> = {
    quem: textoQuemLeva(evento, needs, pledges),
    falta: textoFalta(evento, needs, link),
  }

  async function copiar(t: Texto) {
    try {
      await navigator.clipboard.writeText(textos[t])
      setCopiado(t)
      setTimeout(() => setCopiado(null), 2500)
    } catch {
      window.prompt('Copie o texto:', textos[t])
    }
  }

  function baixarCsv() {
    const blob = new Blob([gerarCsv(needs, pledges, usuarios, evento.categorias)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `lanche-coletivo-${evento.id}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="card space-y-3" aria-labelledby="exp-t">
      <h2 id="exp-t" className="text-lg font-medium">
        Exportar
      </h2>

      <div role="tablist" aria-label="Texto para o WhatsApp" className="flex gap-2">
        {(['quem', 'falta'] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={aberto === t}
            className={aberto === t ? 'btn-primary' : 'btn-ghost'}
            onClick={() => setAberto(t)}
          >
            {t === 'quem' ? 'Quem leva o quê' : 'O que falta'}
          </button>
        ))}
      </div>

      <textarea
        readOnly
        aria-label="Texto pronto para o WhatsApp"
        className="h-56 w-full rounded-xl border border-line bg-surface p-3 font-mono text-sm"
        value={textos[aberto]}
        onFocus={(e) => e.currentTarget.select()}
      />

      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-primary" onClick={() => copiar(aberto)}>
          {copiado === aberto ? 'Copiado!' : 'Copiar para o WhatsApp'}
        </button>
        <button type="button" className="btn-ghost" onClick={baixarCsv}>
          Baixar CSV (com e-mails)
        </button>
      </div>
      <p className="text-xs text-muted">
        O CSV contém e-mails: use só para organizar o evento e não compartilhe. Abre direto no Excel (separador “;”).
      </p>
    </section>
  )
}
