import { canonicalJson, hex64, utf8, xxhash64 } from '@mcthaydt/automata-sim/hash'
import { describe, expect, it } from 'vitest'
import { defaultContent } from './default-content.ts'

// A game without `content/` gets a generated minimal flow, hashed exactly as the content compiler hashes
// (DX spec §3.1 defaults): the runtime's boot recomputes the hash and refuses a mismatch.
describe('defaultContent', () => {
  it('flows title → play ⇄ paused, and back to title from paused', () => {
    const { data } = defaultContent()
    expect(data.flow.entry).toBe('title')
    expect(data.flow.screens).toEqual(['title', 'play', 'paused'])
    expect(data.flow.transitions).toEqual([
      { from: 'title', event: 'play', to: 'play', transition: 'cut' },
      { from: 'play', event: 'pause', to: 'paused', transition: 'cut' },
      { from: 'paused', event: 'resume', to: 'play', transition: 'cut' },
      { from: 'paused', event: 'quit', to: 'title', transition: 'cut' },
    ])
  })

  it('carries the content compiler’s hash of its data', () => {
    const { data, hash } = defaultContent()
    expect(hash).toBe(hex64(xxhash64(utf8(canonicalJson(data)))))
  })

  it('has a pinned hash, so a change to the default flow is a deliberate one', () => {
    expect(defaultContent().hash).toBe('9836a6c32ad89a1a')
  })
})
