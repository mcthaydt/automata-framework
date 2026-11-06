import { describe, expect, it } from 'vitest'
import { relocateDemoAssets } from '../scripts/sync-demos'

describe('Nested demo hosting', () => {
  it('relocates bundled asset URLs under the specific demo without changing external URLs', () => {
    const input = '<script src="/assets/main.js"></script><link href="/assets/main.css"><img src="https://example.com/assets/a.png">'
    expect(relocateDemoAssets(input, '/demos/ui/primitives/')).toBe('<script src="/demos/ui/primitives/assets/main.js"></script><link href="/demos/ui/primitives/assets/main.css"><img src="https://example.com/assets/a.png">')
  })
  it('does not rewrite already namespaced asset URLs', () => {
    const input = '<script src="/demos/ui/primitives/assets/main.js"></script>'
    expect(relocateDemoAssets(input, '/demos/ui/primitives/')).toBe(input)
  })
})
