// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { fakeHostOptions } from '../../../../../playground/src/ruken/fake-host-options.ts'

describe('fakeHostOptions', () => {
  it("keeps the fake host's defaults when the example has no Host header", () => {
    expect(fakeHostOptions(undefined)).toEqual({ create: {}, offline: false })
  })

  it('grants exactly what the header lists, seeds its saves and takes the network down', () => {
    expect(fakeHostOptions({ grant: ['saves'], saves: { best: '12.5' }, offline: true })).toEqual({
      create: { grant: ['saves'], saves: { best: '12.5' } },
      offline: true,
    })
  })

  it('denies everything for an empty grant', () => {
    expect(fakeHostOptions({ grant: [] })).toEqual({ create: { grant: [] }, offline: false })
  })
})
