// A level's horizon for the look's sky: the layers its `sky` names, each swatch resolved to the colour it is drawn in.
import type { HorizonLayer } from '../features/look/passes/sky-effect.ts'
import type { WorldLibrary } from '../features/world/swatches.ts'
import { swatchColour } from '../features/world/swatches.ts'
import type { AfSector2 } from '../shared/level/af-sector-2.schema.ts'

/** The level's horizon layers, farthest first; a layer whose swatch the library lacks is left out. */
export function horizonOf(level: AfSector2, library: WorldLibrary): HorizonLayer[] {
  return (level.sky?.horizon ?? []).flatMap((layer) => {
    const rgb = swatchColour(library, layer.swatch)
    if (rgb === undefined) return []
    return [
      {
        kind: layer.kind,
        colour: `#${rgb.toString(16).padStart(6, '0')}`,
        height: layer.height,
        ...(layer.seed === undefined ? {} : { seed: layer.seed }),
      },
    ]
  })
}
