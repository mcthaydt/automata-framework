// G3-t's catalog check (GAME-3D.1a part 2, DESIGN.md §12.3): base-3d's words come from its catalog
// (src/messages/ui/en.json, compiled by Paraglide), and the copy reads every key the catalog has and no other, so
// `t()` never throws on a key the catalog lacks and the catalog carries no word nothing shows.
import { describe, expect, it } from 'vitest'
import catalog from '../messages/ui/en.json' with { type: 'json' }
import { BASE3D_COPY, copyFrom } from './copy.ts'

/** Every key `copyFrom` reads, calling each word that takes inputs. */
function keysRead(): string[] {
  const keys = new Set<string>()
  const visit = (value: unknown): void => {
    if (typeof value === 'function') (value as (...inputs: unknown[]) => unknown)(1, 2)
    else if (value !== null && typeof value === 'object')
      for (const inner of Object.values(value)) visit(inner)
  }
  visit(
    copyFrom((key) => {
      keys.add(key)
      return key
    }),
  )
  return [...keys].sort()
}

describe('the catalog (G3-t)', () => {
  it('holds exactly the keys the copy reads', () => {
    const catalogKeys = Object.keys(catalog)
      .filter((key) => key !== '$schema')
      .sort()
    expect(keysRead()).toEqual(catalogKeys)
  })

  it('gives the copy its English words through t()', () => {
    const copy = BASE3D_COPY.en
    expect(copy.title).toBe('The Cold Kiln')
    expect(copy.hud.hearts(7, 10)).toBe('Hearts 3.5 of 5')
    expect(copy.gameOver.continue).toBe('Continue')
    expect(copy.keys.pickup).toBe('Pick up')
  })
})
