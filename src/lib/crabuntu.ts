/** Falas do Crabuntu, o mascote do GDG Aracaju. `{item}` vira o nome do item contribuído. */

export type MomentoCrabuntu = 'criou' | 'editou' | 'cancelou'

export const FRASES: Record<MomentoCrabuntu, string[]> = {
  criou: [
    'Obrigado pela colaboração! Vamos encher o bucho juntos! 🦀',
    '{item} garantido! Seu caranguejo favorito agradece! 🦀',
    'Isso aí! Com você o coffee break fica de outro nível! 🥐',
    'Que moral! {item} na conta. A galera vai ficar feliz da vida! 🎉',
    'Pinça aqui! 🦀 Valeu por colaborar, vai ter lanche pra todo mundo!',
    'Missão cumprida! Agora é só esperar a hora de comer. 😋',
  ],
  editou: [
    'Ajuste feito! Quem planeja bem, come bem. 🦀',
    'Atualizado! Continua contando com você. 😉',
    'Beleza, anotei a mudança no {item}! 📝',
  ],
  cancelou: [
    'Tudo bem! Se mudar de ideia, eu tô por aqui. 🦀',
    'Sem problema, a vida acontece! Fica a vaga pra outra pessoa. 💙',
    'Anotado! Qualquer coisa, volta aqui e escolhe outro item.',
  ],
}

/** Sorteia uma fala; `rand` injetável para teste. */
export function escolherFrase(momento: MomentoCrabuntu, item: string, rand: () => number = Math.random): string {
  const pool = FRASES[momento]
  const i = Math.min(Math.floor(rand() * pool.length), pool.length - 1)
  return (pool[i] as string).replaceAll('{item}', item)
}
