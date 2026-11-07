// The core library every game gets: FigureBuilder's and EnvironmentBuilder's swatches, the prop presets and the kits
// the dresser dresses a room from. A game merges its own (the `world-swatch`, `world-prop` and `world-kit` content)
// over it with `mergeLibrary`: its names win.
import kits from './library/kits.json' with { type: 'json' }
import props from './library/props.json' with { type: 'json' }
import swatches from './library/swatches.json' with { type: 'json' }
import type { WorldLibrary } from './swatches.ts'

export const CORE_LIBRARY: WorldLibrary = { swatches, props, kits }

/** The libraries laid one over another: a later one's names replace an earlier one's. */
export function mergeLibrary(...libraries: readonly WorldLibrary[]): WorldLibrary {
  const merged = (pick: (library: WorldLibrary) => Readonly<Record<string, unknown>> | undefined) =>
    Object.assign({}, ...libraries.map((library) => pick(library) ?? {}))
  return { swatches: merged((l) => l.swatches), props: merged((l) => l.props), kits: merged((l) => l.kits) }
}
