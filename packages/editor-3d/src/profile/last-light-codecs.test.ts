// The two file codecs ED3D.1 delivers: parse with schema errors that carry JSON paths, and patch that leaves an
// unchanged file byte-identical.
import { describe, expect, it } from 'vitest'
import { FIXTURE_NAMES, loadFixture } from '../testing/fixtures'
import { blockoutCodec, facilityCodec } from './last-light-codecs'

const CODECS = {
  'blockout-clinic': blockoutCodec,
  'blockout-clinic-dawn': blockoutCodec,
  'blockout-bay': blockoutCodec,
  'blockout-prologue': blockoutCodec,
  facility: facilityCodec,
} as const

describe('last light file codecs', () => {
  it('names the codecs', () => {
    expect(blockoutCodec.id).toBe('last-light-blockout')
    expect(facilityCodec.id).toBe('last-light-facility')
  })

  for (const name of FIXTURE_NAMES) {
    const codec = CODECS[name]

    it(`${name}: parses to the file's value`, () => {
      const text = loadFixture(name)
      const parsed = codec.parse(text)
      expect(parsed.ok && parsed.value).toStrictEqual(JSON.parse(text))
    })

    it(`${name}: a patch from a model to itself is byte-identical`, () => {
      const text = loadFixture(name)
      const parsed = codec.parse(text)
      if (!parsed.ok) throw new Error('fixture does not parse')
      // biome-ignore lint/suspicious/noExplicitAny: the codec table above is typed by name, the call is not
      const patched = (codec as any).patch(text, parsed.value, structuredClone(parsed.value))
      expect(patched).toStrictEqual({ ok: true, text })
    })
  }

  it('returns issues with JSON paths for a file that does not fit the schema', () => {
    const model = JSON.parse(loadFixture('blockout-clinic'))
    model.rooms[0].ceiling = 'high'
    delete model.spawn
    const parsed = blockoutCodec.parse(JSON.stringify(model))
    expect(parsed.ok).toBe(false)
    const paths = !parsed.ok ? parsed.issues.map((issue) => JSON.stringify(issue.path)) : []
    expect(paths).toContain('["rooms",0,"ceiling"]')
    expect(paths).toContain('["spawn"]')
    expect(!parsed.ok && parsed.issues.every((issue) => issue.message.length > 0)).toBe(true)
  })

  it('returns one issue at the root for text that is not JSON, with where', () => {
    const parsed = blockoutCodec.parse('{ "scene": "x", }')
    expect(parsed).toMatchObject({ ok: false, issues: [{ path: [] }] })
    expect(!parsed.ok && parsed.issues[0]?.message).toMatch(/at \d+/)
  })

  it('refuses a file that is JSON but not an object of the right kind at the root', () => {
    expect(facilityCodec.parse('[]')).toMatchObject({ ok: false, issues: [{ path: [] }] })
  })

  it('places a new top-level member where the format puts it: anchors back before exports', () => {
    const text = loadFixture('blockout-bay')
    const parsed = blockoutCodec.parse(text)
    if (!parsed.ok) throw new Error('fixture does not parse')
    const { anchors: _removed, ...without } = parsed.value
    const dropped = blockoutCodec.patch(text, parsed.value, without)
    if (!dropped.ok) throw new Error(dropped.detail)
    expect(Object.keys(JSON.parse(dropped.text))).not.toContain('anchors')
    const back = blockoutCodec.patch(dropped.text, without, parsed.value)
    expect(back.ok && Object.keys(JSON.parse(back.text))).toEqual(Object.keys(JSON.parse(text)))
  })
})
