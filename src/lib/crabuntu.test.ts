import { describe, expect, it } from 'vitest'
import { FRASES, escolherFrase, type MomentoCrabuntu } from '@/lib/crabuntu'

describe('Crabuntu', () => {
  it('há várias falas para criar e todas são curtas', () => {
    expect(FRASES.criou.length).toBeGreaterThanOrEqual(4)
    for (const pool of Object.values(FRASES)) pool.forEach((f) => expect(f.length).toBeLessThanOrEqual(90))
  })

  it('a fala pedida pelo usuário existe', () => {
    expect(FRASES.criou).toContain('Obrigado pela colaboração! Vamos encher o bucho juntos! 🦀')
  })

  it('substitui {item} e nunca deixa placeholder', () => {
    for (const momento of Object.keys(FRASES) as MomentoCrabuntu[]) {
      for (let i = 0; i < FRASES[momento].length; i++) {
        const f = escolherFrase(momento, 'Refrigerante', () => i / FRASES[momento].length)
        expect(f).not.toContain('{item}')
      }
    }
    expect(escolherFrase('criou', 'Suco', () => 0.17)).toContain('Suco')
  })

  it('é determinístico com rand fixo e aguenta rand = 1', () => {
    expect(escolherFrase('editou', 'X', () => 0)).toBe(escolherFrase('editou', 'X', () => 0))
    expect(() => escolherFrase('cancelou', 'X', () => 1)).not.toThrow()
  })
})
