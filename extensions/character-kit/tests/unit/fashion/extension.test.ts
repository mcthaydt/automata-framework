import { describe, expect, it } from 'vitest'
import { characterKitExtension } from '#src/app/character-kit.extension.ts'
import { registerFashion } from '#src/features/fashion/register-fashion.ts'
import { registerGarment } from '#src/shared/figure-builder/door.ts'

describe("the kit's extension", () => {
  it('puts the runway wardrobe on the figure builder when it loads, and loading it again changes nothing', () => {
    expect(characterKitExtension.name).toBe('character-kit')
    for (const kind of ['tee', 'hoodie', 'jacket', 'coat', 'skirt', 'dress', 'jeans', 'trousers', 'shoes']) {
      expect(() => registerGarment(kind, { build: () => ({ parts: [] }) }), kind).toThrow(
        /registered already/,
      )
    }
    expect(() => registerFashion()).not.toThrow()
  })
})
