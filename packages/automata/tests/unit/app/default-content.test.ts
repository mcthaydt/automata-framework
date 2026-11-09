import { canonicalJson, hex64, utf8, xxhash64 } from '@automata/sim/hash'
import { describe, expect, it } from 'vitest'
import { defaultContent } from '#src/app/default-content.ts'

// A game without `content/` gets a generated minimal flow, hashed exactly as the content compiler hashes
// (DX spec §3.1 defaults): the runtime's boot recomputes the hash and refuses a mismatch.
describe('defaultContent', () => {
  it('flows title → play ⇄ paused, back to title from paused, and paused ⇄ settings (M4.4)', () => {
    const { data } = defaultContent()
    expect(data.flow.entry).toBe('title')
    expect(data.flow.screens).toEqual(['title', 'play', 'paused', 'settings'])
    expect(data.flow.transitions).toEqual([
      { from: 'title', event: 'play', to: 'play', transition: 'cut' },
      { from: 'play', event: 'pause', to: 'paused', transition: 'cut' },
      { from: 'paused', event: 'resume', to: 'play', transition: 'cut' },
      { from: 'paused', event: 'quit', to: 'title', transition: 'cut' },
      { from: 'paused', event: 'settings', to: 'settings', transition: 'cut' },
      { from: 'settings', event: 'back', to: 'paused', transition: 'cut' },
    ])
  })

  it('carries the content compiler’s hash of its data', () => {
    const { data, hash } = defaultContent()
    expect(hash).toBe(hex64(xxhash64(utf8(canonicalJson(data)))))
  })

  it('has a pinned hash, so a change to the default flow is a deliberate one', () => {
    // M4.4 added the Settings screen to the flow (was 9836a6c32ad89a1a).
    expect(defaultContent().hash).toBe('083dacc3c34d55d9')
  })
})
