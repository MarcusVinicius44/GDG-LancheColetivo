import { describe, expect, it } from 'vitest'
import { MENSAGENS, mensagemErroAdmin } from '@/lib/errors'

describe('mensagemErroAdmin', () => {
  const sdk = (code: string) => Object.assign(new Error('x'), { code })

  it('permission-denied explica o que provavelmente aconteceu', () => {
    expect(mensagemErroAdmin(sdk('permission-denied'))).toMatch(/alguém acabou de contribuir/)
    expect(mensagemErroAdmin(sdk('firestore/permission-denied'))).toMatch(/alguém acabou de contribuir/)
  })

  it('conflitos, rede e login caem nas mensagens padrão', () => {
    expect(mensagemErroAdmin(sdk('aborted'))).toBe(MENSAGENS.concorrencia)
    expect(mensagemErroAdmin(sdk('failed-precondition'))).toBe(MENSAGENS.concorrencia)
    expect(mensagemErroAdmin(sdk('unavailable'))).toBe(MENSAGENS.rede)
    expect(mensagemErroAdmin(sdk('unauthenticated'))).toBe(MENSAGENS['nao-logado'])
  })

  it('erro de domínio em pt-BR (sem código do SDK) passa como está', () => {
    expect(mensagemErroAdmin(new Error('Já existe uma categoria com esse nome.'))).toBe('Já existe uma categoria com esse nome.')
  })

  it('código desconhecido ou valor estranho não vaza texto técnico', () => {
    expect(mensagemErroAdmin(sdk('internal'))).toBe(MENSAGENS.desconhecido)
    expect(mensagemErroAdmin('boom')).toBe(MENSAGENS.desconhecido)
    expect(mensagemErroAdmin(null)).toBe(MENSAGENS.desconhecido)
    expect(mensagemErroAdmin(new Error(''))).toBe(MENSAGENS.desconhecido)
  })
})
