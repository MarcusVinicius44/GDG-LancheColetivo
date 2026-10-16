import { describe, expect, it } from 'vitest'
import { isInAppBrowser } from './inAppBrowser'
import { formatDataHora, norm, primeiroNome } from './format'

describe('primeiroNome', () => {
  it('usa o 1º token', () => expect(primeiroNome('Maria da Silva')).toBe('Maria'))
  it('ignora espaço inicial', () => expect(primeiroNome('  João Pedro')).toBe('João'))
  it('fallback sem nome / vazio / só espaços', () => {
    expect(primeiroNome(undefined)).toBe('Participante')
    expect(primeiroNome('')).toBe('Participante')
    expect(primeiroNome('   ')).toBe('Participante')
  })
  it('fallback se 1º token > 40', () => expect(primeiroNome('a'.repeat(41))).toBe('Participante'))
})

describe('norm', () => {
  it('remove acentos, caixa e espaços das pontas', () => {
    expect(norm('  Guaraná Antarctica ')).toBe('guarana antarctica')
    expect(norm('Pão de Açúcar ÑOÑO')).toBe('pao de acucar nono')
  })
})

describe('formatDataHora', () => {
  it('exibe em America/Fortaleza (UTC-3)', () => {
    expect(formatDataHora(new Date('2026-10-31T11:30:00Z'))).toContain('08:30')
  })
})

describe('isInAppBrowser', () => {
  it('detecta Instagram/WhatsApp/Facebook', () => {
    expect(isInAppBrowser('Mozilla/5.0 (iPhone) Instagram 300.0')).toBe(true)
    expect(isInAppBrowser('Mozilla/5.0 (Linux; Android) WhatsApp/2.24')).toBe(true)
    expect(isInAppBrowser('Mozilla/5.0 [FBAN/FBIOS;FBAV/450.0]')).toBe(true)
  })
  it('não marca Chrome/Safari', () => {
    expect(isInAppBrowser('Mozilla/5.0 (Windows NT 10.0) Chrome/120 Safari/537')).toBe(false)
  })
})
