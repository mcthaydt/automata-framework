import type { StageValue } from './stage.schema'

// The scenery a stage resolves to (FloorFifty `apps/client/src/systems/render/stage-presentation.ts`, ported for the
// Compose view, 2D editor spec §10.4): the layers with their defaults filled in, the light, the horizon lift and the
// ascent arc of the city. Pure data in, pure data out; `composeStage` says where each piece stands.

/** The near skyline's parallax factor: an unauthored arc share is a layer's depth over this. */
export const NEAR_CITY_FACTOR = 0.35

/** Where the light stands when a stage says nothing: low behind the rooftops. */
export const DEFAULT_LIGHT_HEIGHT = -60

export interface ResolvedLayer {
  readonly alias: string
  readonly plate: 'sky' | 'city'
  readonly depth: number
  readonly sink: number
  readonly haze: number
  readonly extend: 'none' | 'skirt' | 'tile' | 'plate'
  /** The layer's share of the city's sink; 0 for a sky layer. */
  readonly arc: number
  readonly drift: number
}

/** A point of the ascent arc: the sink of the city once the climb has reached `at` (0 to 1). */
export interface ArcKnot {
  readonly at: number
  readonly sink: number
}

export interface Scenery {
  readonly lightAlias: string | undefined
  /** How far above the world origin the light stands. */
  readonly lightHeight: number
  readonly horizonLift: number
  /** From (0, 0) to (1, the finish); empty where no arc or no course is authored. */
  readonly citySink: readonly ArcKnot[]
  /** Back to front, as in the file. */
  readonly layers: readonly ResolvedLayer[]
}

function resolveLayer(layer: StageValue['theme']['layers'][number]): ResolvedLayer {
  return {
    alias: layer.alias,
    plate: layer.plate,
    depth: layer.depth,
    sink: layer.sink,
    extend: layer.extend,
    haze: layer.haze ?? 0,
    arc: layer.plate === 'city' ? (layer.arc ?? layer.depth / NEAR_CITY_FACTOR) : 0,
    drift: layer.drift ?? 0,
  }
}

/**
 * The ascent arc's knots. Each phrase's value stands where the phrase ends, measured in floors: a phrase ending on floor
 * `n` of a climb whose last phrase ends on `last` is at `(n + 1) / (last + 1)` of the ascent, so the finish lands on 1. A
 * value smaller than the one before it is held at that one, because a city that rose again mid-climb would read as the
 * tower sinking.
 */
function arcKnots(value: StageValue): readonly ArcKnot[] {
  const values = value.theme.presentation?.citySink
  const phrases = value.course?.phrases ?? []
  if (values === undefined || phrases.length === 0) return []

  const last = Math.max(...phrases.map((phrase) => phrase.toFloor))
  const knots: ArcKnot[] = [{ at: 0, sink: 0 }]
  for (const phrase of [...phrases].sort((a, b) => a.toFloor - b.toFloor)) {
    const previous = knots[knots.length - 1]
    knots.push({
      at: (phrase.toFloor + 1) / (last + 1),
      sink: Math.max(previous?.sink ?? 0, values[phrase.name]),
    })
  }
  return knots
}

export function resolveScenery(value: StageValue): Scenery {
  const presentation = value.theme.presentation
  return {
    lightAlias: value.theme.lightAlias,
    lightHeight: presentation?.lightHeight ?? DEFAULT_LIGHT_HEIGHT,
    horizonLift: presentation?.horizonLift ?? 0,
    citySink: arcKnots(value),
    layers: value.theme.layers.map(resolveLayer),
  }
}

/**
 * How far the city has sunk at `progress` through the climb: linear between the knots, so it is continuous at every
 * phrase boundary, and 0 where no arc is authored.
 */
export function citySinkAt(scenery: Scenery, progress: number): number {
  const knots = scenery.citySink
  if (knots.length === 0) return 0
  const t = Math.min(1, Math.max(0, progress))
  for (let index = 1; index < knots.length; index++) {
    const from = knots[index - 1]
    const to = knots[index]
    if (from === undefined || to === undefined) continue
    if (t <= to.at) {
      const span = to.at - from.at
      return span <= 0 ? to.sink : from.sink + ((t - from.at) / span) * (to.sink - from.sink)
    }
  }
  return knots[knots.length - 1]?.sink ?? 0
}
