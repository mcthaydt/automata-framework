import { describe, expect, it } from 'vitest'
import { horizonOf } from '#src/app/level-sky.ts'
import { BASE_SCENES } from '#src/features/world/base/base-scenes.ts'
import { coreLibrary } from '#src/features/world/base/core-library.ts'

describe('a level’s horizon for the sky', () => {
  it('is the layers of the level’s sky with their swatches’ colours, in order', () => {
    const layers = horizonOf(BASE_SCENES['base-exterior'], coreLibrary)
    expect(layers).toHaveLength(1)
    expect(layers[0]).toMatchObject({ kind: 'city', height: 0.2, seed: 3 })
    expect(layers[0]?.colour).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('is empty for a room with no sky, and skips a layer whose swatch the library lacks', () => {
    expect(horizonOf(BASE_SCENES['base-interior'], coreLibrary)).toEqual([])
    const broken = {
      ...BASE_SCENES['base-exterior'],
      sky: { horizon: [{ kind: 'hills' as const, swatch: 'nope', height: 0.1 }] },
    }
    expect(horizonOf(broken, coreLibrary)).toEqual([])
  })
})
