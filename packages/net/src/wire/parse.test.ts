import { afterEach, describe, expect, it, vi } from 'vitest'
import { MAX_MESSAGE_BYTES } from './limits'
import { parseClientMessage, parseServerMessage } from './parse'

// SV-a (M7 spec §13): a message past the size cap is dropped before parsing.

/** A valid command whose JSON is exactly `bytes` long, padded in the payload. */
function commandOfSize(bytes: number): string {
  const base = JSON.stringify({ t: 'cmd', seq: 0, tick: 1, type: 'move', payload: '' })
  return JSON.stringify({ t: 'cmd', seq: 0, tick: 1, type: 'move', payload: 'x'.repeat(bytes - base.length) })
}

afterEach(() => vi.restoreAllMocks())

describe('parseClientMessage', () => {
  it('parses a message of exactly the cap', () => {
    const raw = commandOfSize(MAX_MESSAGE_BYTES)
    expect(raw.length).toBe(16_384)
    expect(parseClientMessage(raw)).toMatchObject({ ok: true, message: { t: 'cmd' } })
  })

  it('drops a message one byte past the cap without parsing it', () => {
    const parse = vi.spyOn(JSON, 'parse')
    expect(parseClientMessage(commandOfSize(MAX_MESSAGE_BYTES + 1))).toMatchObject({
      ok: false,
      reason: 'too-large',
    })
    expect(parse).not.toHaveBeenCalled()
  })

  it('counts bytes, not characters', () => {
    // 'é' is two bytes in UTF-8: half the cap in characters is the whole cap in bytes, plus the envelope.
    const raw = JSON.stringify({
      t: 'cmd',
      seq: 0,
      tick: 1,
      type: 'move',
      payload: 'é'.repeat(MAX_MESSAGE_BYTES / 2),
    })
    expect(raw.length).toBeLessThan(MAX_MESSAGE_BYTES)
    expect(parseClientMessage(raw)).toMatchObject({ ok: false, reason: 'too-large' })
  })

  it('measures binary messages by their length', () => {
    expect(parseClientMessage(new Uint8Array(MAX_MESSAGE_BYTES + 1))).toMatchObject({
      ok: false,
      reason: 'too-large',
    })
  })

  it('reports text that is not JSON, and a message that fails the schema', () => {
    expect(parseClientMessage('{nope')).toMatchObject({ ok: false, reason: 'not-json' })
    expect(parseClientMessage('{"t":"cmd"}')).toMatchObject({ ok: false, reason: 'invalid' })
  })
})

describe('parseServerMessage', () => {
  it('applies the same cap and schema', () => {
    expect(parseServerMessage('{"t":"seated","seat":1}')).toEqual({
      ok: true,
      message: { t: 'seated', seat: 1 },
    })
    expect(parseServerMessage('{"t":"seated","seat":1,"x":0}')).toMatchObject({
      ok: false,
      reason: 'invalid',
    })
  })
})
