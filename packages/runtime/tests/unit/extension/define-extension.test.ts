import { describe, expect, expectTypeOf, it } from 'vitest'
import { defineExtension } from '#src/extension/define-extension.ts'

describe('defineExtension', () => {
  it('returns the object it was given, keeping the literal name type', () => {
    const def = { name: 'audio' } as const
    const result = defineExtension(def)

    expect(result).toBe(def)
    expectTypeOf(defineExtension({ name: 'audio' }).name).toEqualTypeOf<'audio'>()
  })

  it('accepts a manifest contribution that preloads files', () => {
    const def = defineExtension({
      name: 'art',
      manifest: () => ({ loading: { preload: ['a.png'] } }),
    })

    expect(def.manifest?.({} as never)).toEqual({ loading: { preload: ['a.png'] } })
  })

  it('rejects a manifest contribution outside Ruken fields (Q7: wants is not a manifest field)', () => {
    defineExtension({
      name: 'leaderboards',
      // @ts-expect-error `wants` is not part of RukenManifestContribution.
      manifest: () => ({ wants: ['leaderboards'] }),
    })
  })
})
