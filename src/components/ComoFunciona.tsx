import { useRef } from 'react'

const PASSOS = [
  {
    titulo: 'Veja o que falta',
    texto: 'Abra o evento e veja a lista do coffee break, por categoria. A barra de cada item mostra quanto já foi escolhido.',
  },
  {
    titulo: 'Entre com o Google',
    texto: 'Para contribuir você entra com a sua conta Google. Só precisa disso na hora de escolher; para olhar a lista não precisa.',
  },
  {
    titulo: 'Escolha o que você leva',
    texto: 'Toque em “Quero levar”, escolha a quantidade e, quando houver, o sabor ou a marca. Se a meta do item já foi atingida, ele aparece como esgotado.',
  },
  {
    titulo: 'Mudou de ideia? Sem problema',
    texto: 'Você pode editar ou cancelar a sua parte em “Minhas contribuições”. Depois do prazo só dá para reduzir ou cancelar, para a organização conseguir se planejar.',
  },
  {
    titulo: 'No dia do evento',
    texto: 'Leve exatamente o que você escolheu. Itens marcados com “devolver no final” (garrafa térmica, faca…) voltam para você.',
  },
]

export function ComoFunciona() {
  const ref = useRef<HTMLDialogElement>(null)

  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        className="inline-flex items-center gap-1.5 rounded-full border border-gdg-blue px-3 py-1 text-sm font-medium text-gdg-blue transition hover:bg-gdg-blue/10"
      >
        <span aria-hidden="true">ⓘ</span> Como funciona
      </button>

      <dialog
        ref={ref}
        onClick={(e) => e.target === ref.current && ref.current?.close()}
        aria-labelledby="como-funciona-titulo"
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-card border border-line bg-white p-0 text-ink shadow-xl backdrop:bg-ink/40"
      >
        <div className="max-h-[85dvh] space-y-4 overflow-y-auto p-5">
          <header className="flex items-start justify-between gap-3">
            <h2 id="como-funciona-titulo" className="text-lg font-medium">
              Como funciona o Lanche Coletivo
            </h2>
            <button type="button" onClick={() => ref.current?.close()} aria-label="Fechar" className="btn-ghost !min-h-9 !px-3">
              ✕
            </button>
          </header>

          <p className="text-sm text-muted">
            O coffee break dos eventos do GDG Aracaju é feito por todo mundo. Em poucos passos você escolhe o que leva:
          </p>

          <ol className="space-y-3">
            {PASSOS.map((p, i) => (
              <li key={p.titulo} className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gdg-blue text-sm font-medium text-white">
                  {i + 1}
                </span>
                <div>
                  <p className="font-medium">{p.titulo}</p>
                  <p className="text-sm text-muted">{p.texto}</p>
                </div>
              </li>
            ))}
          </ol>

          <p className="rounded-xl bg-surface p-3 text-sm text-muted">
            <strong className="text-ink">Privacidade:</strong> aparece para todos só o seu primeiro nome. O e-mail fica
            visível apenas para a organização e é usado só para este evento.
          </p>

          <button type="button" className="btn-primary w-full" onClick={() => ref.current?.close()}>
            Entendi
          </button>
        </div>
      </dialog>
    </>
  )
}
