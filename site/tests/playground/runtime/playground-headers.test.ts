// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { playgroundHeaders } from '../../../src/features/playground/headers.ts'

describe('playgroundHeaders', () => {
  it('lets an opaque-origin frame load the content-hashed runtime and caches it for good', () => {
    expect(playgroundHeaders('/playground/runtime/automata-1a2b3c.js')).toEqual({
      'Access-Control-Allow-Origin': '*',
      'Cross-Origin-Resource-Policy': 'cross-origin',
      'Cache-Control': 'public, max-age=31536000, immutable',
    })
  })

  it('revalidates everything else under /playground/', () => {
    expect(playgroundHeaders('/playground/examples/core/basic-window/')).toEqual({
      'Access-Control-Allow-Origin': '*',
      'Cross-Origin-Resource-Policy': 'cross-origin',
      'Cache-Control': 'no-cache',
    })
  })

  it('adds nothing outside /playground/', () => {
    expect(playgroundHeaders('/examples/shapes-rects')).toEqual({})
    expect(playgroundHeaders('/playgroundx/runtime/a.js')).toEqual({})
    expect(playgroundHeaders('/')).toEqual({})
  })
})
