// The kit's library: every entry parses, every name a kit, a preset or a swatch uses is in it, and a base name is
// told once (the kit's swatch of a base name is the textured one of the same colour).

import { describe, expect, it } from 'vitest'
import { baseLibrary } from '#src/features/world/base/base-library.ts'
import { coreLibrary } from '#src/features/world/base/core-library.ts'
import { worldPropContent, worldSwatchContent } from '#src/features/world/content/world.content.ts'
import { worldKitSchema } from '#src/features/world/furnish/kit.schema.ts'
import props from '#src/features/world/library/props.json' with { type: 'json' }
import swatches from '#src/features/world/library/swatches.json' with { type: 'json' }

describe('the kit’s library', () => {
  it('has swatches that parse', () => {
    for (const [name, swatch] of Object.entries(coreLibrary.swatches))
      expect(worldSwatchContent.schema.safeParse(swatch).success, name).toBe(true)
  })
  it('has prop presets that parse', () => {
    for (const [name, preset] of Object.entries(coreLibrary.props ?? {}))
      expect(worldPropContent.schema.safeParse(preset).success, name).toBe(true)
  })
  it('has kits that parse, and the presets they use are in the library', () => {
    for (const [name, kit] of Object.entries(coreLibrary.kits ?? {})) {
      const parsed = worldKitSchema.safeParse(kit)
      expect(parsed.success, name).toBe(true)
      if (!parsed.success) continue
      const used = [
        ...parsed.data.furniture.flatMap((slot) => (typeof slot.use === 'string' ? [slot.use] : slot.use)),
        ...(parsed.data.fixtures.art ?? []),
        ...(parsed.data.fixtures.outdoor ?? []),
        ...(parsed.data.clutter?.on ?? []),
        ...(parsed.data.floor?.use ?? []),
        ...(parsed.data.ceiling === undefined ? [] : [parsed.data.ceiling.use]),
      ]
      for (const use of used) expect(coreLibrary.props?.[use], `${name} -> ${use}`).toBeDefined()
    }
  })
  it('does not tell a base preset again', () => {
    for (const name of Object.keys(props)) expect(baseLibrary.props?.[name], name).toBeUndefined()
  })
  it('gives a base swatch a texture, never another colour', () => {
    for (const [name, swatch] of Object.entries(swatches)) {
      const base = baseLibrary.swatches[name] as { ramp: string; step: number } | undefined
      if (base === undefined) continue
      expect({ ramp: swatch.ramp, step: swatch.step }, name).toEqual({ ramp: base.ramp, step: base.step })
    }
  })
})
