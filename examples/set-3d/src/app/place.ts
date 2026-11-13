// The place an example plays in: the station's level built into a world from the set's swatches and props, the probe a
// journey reads, and the example's few lines run over both. Presentation only (law 1): it reads the sim, never writes it.
import { buildWorld, type WorldLibrary } from '@automata/3d'
import { STATION } from '../shared/station.ts'
import type { SceneContext, SceneOptions, SceneProbe } from './scene-options.ts'

/** The swatches and props the level names, from the set's content (`content/world-swatches`, `content/world-props`). */
export function worldLibraryOf(content: unknown): WorldLibrary {
  const kinds = content as {
    readonly 'world-swatch': WorldLibrary['swatches']
    readonly 'world-prop'?: NonNullable<WorldLibrary['props']>
  }
  return {
    swatches: kinds['world-swatch'],
    ...(kinds['world-prop'] === undefined ? {} : { props: kinds['world-prop'] }),
  }
}

/**
 * The probe. The walker, the rules' facts and what is carried are the sim's and the kits' to answer, so they answer
 * nothing yet: zone and hour are the options', and a journey that asks for the rest gets `undefined` and no items.
 */
export function probeOf(options: SceneOptions): SceneProbe {
  return {
    zone: () => options.start,
    time: () => options.time ?? 'day',
    fact: () => undefined,
    carried: () => [],
  }
}

/** Builds the station's world and hands it, with the level and the probe, to the example's own lines. */
export function placeOf(options: SceneOptions, library: WorldLibrary): SceneContext {
  const place: SceneContext = { world: buildWorld(STATION, library), level: STATION, probe: probeOf(options) }
  options.on?.(place)
  return place
}
