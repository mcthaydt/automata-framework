import { NET_ERROR_CODES } from '@mcthaydt/automata-net'
import { describe, expect, it } from 'vitest'
import { NET_COPY_EN, netCopyKeys, netText } from './net-copy'

// The words `net` puts on screen (M7 spec §7): locale keys with an English catalog. Every `NetError` code has its own message,
// and each message names the cause and the next action (QB, PRODUCT.6).

describe('the English catalog', () => {
  it('has a message for every NetError code, keyed net.error.<CODE>', () => {
    for (const code of NET_ERROR_CODES) expect(NET_COPY_EN[`net.error.${code}`], code).toBeTruthy()
  })
  it('has no key that is not a net.* key, and none empty', () => {
    for (const [key, text] of Object.entries(NET_COPY_EN)) {
      expect(key.startsWith('net.'), key).toBe(true)
      expect(text.trim(), key).not.toBe('')
    }
    expect(netCopyKeys()).toEqual(Object.keys(NET_COPY_EN).sort())
  })
  it('names the next action in each error message', () => {
    const action = /(try|reload|wait|check|leave|ask|again)/i
    for (const code of NET_ERROR_CODES) expect(NET_COPY_EN[`net.error.${code}`], code).toMatch(action)
  })
})

describe('netText', () => {
  it('fills {name} placeholders', () => {
    expect(netText('net.badge.reconnecting', { seconds: 12 })).toBe('Reconnecting… 12 s')
  })
  it('leaves a placeholder with no value as written, so a missing param shows', () => {
    expect(netText('net.badge.reconnecting')).toContain('{seconds}')
  })
  it('uses the catalog it is given, so a locale can replace the words', () => {
    expect(netText('net.reconnect.leave', {}, { ...NET_COPY_EN, 'net.reconnect.leave': 'Salir' })).toBe(
      'Salir',
    )
  })
})
