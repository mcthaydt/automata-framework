// The core library: every entry parses, every prop preset draws, and every swatch a preset's parts name is in it.
import { describe, expect, it } from 'vitest'
import { worldPropSchema } from '#src/features/world/content/world-prop.schema.ts'
import { worldSwatchSchema } from '#src/features/world/content/world-swatch.schema.ts'
import { CORE_LIBRARY, mergeLibrary } from '#src/features/world/library.ts'
import { isFault, resolveProp } from '#src/features/world/props/resolve.ts'
import { hasSwatch, swatchColour } from '#src/features/world/swatches.ts'

const props = CORE_LIBRARY.props as Record<string, Record<string, unknown>>

/** The presets that leave a parameter to the place that uses them. */
const WITH: Record<string, Record<string, unknown>> = { runner: { size: [3, 0.8] } }

describe('the core library', () => {
  it('has swatches that parse and have a colour', () => {
    for (const [name, swatch] of Object.entries(CORE_LIBRARY.swatches)) {
      expect(worldSwatchSchema.safeParse(swatch).success, name).toBe(true)
      expect(swatchColour(CORE_LIBRARY, name), name).toBeTypeOf('number')
    }
  })

  it('has prop presets that parse and name a generator', () => {
    for (const [name, preset] of Object.entries(props)) {
      expect(worldPropSchema.safeParse(preset).success, name).toBe(true)
      expect(isFault(resolveProp({ use: name }, CORE_LIBRARY)), name).toBe(false)
    }
  })

  it('draws every preset with swatches the library has', () => {
    const missing: string[] = []
    for (const name of Object.keys(props)) {
      const resolved = resolveProp({ use: name, with: WITH[name] }, CORE_LIBRARY)
      if (isFault(resolved)) continue
      const built = resolved.generator(resolved.params)
      expect(built.pieces.length, name).toBeGreaterThan(0)
      for (const piece of built.pieces)
        if (!hasSwatch(CORE_LIBRARY, piece.swatch))
          missing.push(`${name}: ${piece.label} -> ${String(piece.swatch)}`)
    }
    expect(missing).toEqual([])
  })

  it('merges a game over the core, the game winning', () => {
    const merged = mergeLibrary(CORE_LIBRARY, {
      swatches: { oak: { ramp: 'wine', step: 1 } },
      props: { crate: { kind: 'crate' } },
    })
    expect(merged.swatches.oak).toEqual({ ramp: 'wine', step: 1 })
    expect(merged.swatches.oakFloor).toEqual(CORE_LIBRARY.swatches.oakFloor)
    expect(merged.props?.crate).toEqual({ kind: 'crate' })
    expect(merged.props?.barrel).toEqual(props.barrel)
  })
})
