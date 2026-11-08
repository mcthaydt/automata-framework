import { describe, expect, it } from 'vitest'
import { extractHeader } from '../scripts/sync-demos'

describe('Published demo metadata', () => {
  it('keeps multiline instructions and stops before the next header', () => {
    const source = '// Shows: Move a character through\n// a room with fixed ticks.\n// Files: main.ts\n// Controls: arrows to move,\n// Space to jump.\n// Base: base-2d\n'
    expect(extractHeader(source, 'Shows')).toBe('Move a character through a room with fixed ticks.')
    expect(extractHeader(source, 'Controls')).toBe('arrows to move, Space to jump.')
  })
})
