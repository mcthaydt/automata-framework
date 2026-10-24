import { citySinkAt, type ResolvedLayer, type Scenery } from './stage-scenery'

// Where each layer of a stage stands for a point of the climb (2D editor spec §10.4, decision FF-D4): the formulas of
// FloorFifty's `StageLayers.update` (`apps/client/src/systems/render/stage-layers.ts`) as a pure function. The canvas only
// applies the numbers to sprites; `testing/compose-goldens.json` holds what the game itself computes, to the last bit.
//
// What it leaves out, because it needs a race, a song or a GPU and moves a layer by a few units: the music and race
// reactions (bob, jolt, surge, a set piece's sweep), the sun's heat shimmer, haze baking and window codes. It shows the
// settled composition: the game eases the horizon lift and the city's sink over 0.4 s, and applies them at once under
// reduced motion, so a position along the climb has one answer, where the ease comes to rest.

/** How far a tiled strip runs below its art, in units. The game adds it to the strip and to its sink. */
export const SKIRT_HEIGHT = 4000

/** The share of the camera's climb a city layer keeps, so a bounce still moves the skyline against the platforms. */
const CITY_CAMERA_COUPLING = 0.15

/** How slowly the light moves against the camera: nearly, but not quite, fixed. */
const SUN_PARALLAX = 0.06

/** The light's drawn size against its 256-unit plate. */
const SUN_SCALE = 0.55

export interface ComposeFraming {
  /** Device pixels per unit; city layers are rounded to them. Absent it is 1 (whole units); 0 or less, nothing is rounded. */
  readonly pixelsPerUnit?: number | undefined
  /** The highest a city strip may start at the start of the climb. Portrait sets it so the city holds the lower third. */
  readonly cityTopMin?: number | undefined
  /** The art's height of each alias, which the line above measures. A layer with no height is left out of it. */
  readonly heights?: Readonly<Record<string, number>> | undefined
}

export interface ComposeState {
  readonly cameraY: number
  /** How far through the climb, 0 to 1; anything else is read as the nearer end. */
  readonly progress: number
  /** Ambient seconds, which a drifting layer moves with. */
  readonly timeSeconds: number
  readonly framing?: ComposeFraming | undefined
}

export interface ComposedLayer {
  readonly alias: string
  /** The root it is drawn in: a sky plate is sky, whatever the file says. */
  readonly plate: 'sky' | 'city'
  /** The parallax factor. */
  readonly depth: number
  readonly extend: ResolvedLayer['extend']
  readonly haze: number
  /** Where the strip's bottom edge stands (strips are anchored at the bottom centre; x is 0). */
  readonly y: number
  /** The strip's tile offset; absent for a sky plate, which is one untiled picture. */
  readonly tileX: number | undefined
}

export interface ComposedLight {
  readonly alias: string
  readonly y: number
  readonly scale: number
  /** The light is drawn after this many of the layers: a leading sky plate, else none, so it rises behind the city. */
  readonly after: number
}

export interface Composition {
  /** In drawing order, back to front. */
  readonly layers: readonly ComposedLayer[]
  readonly light: ComposedLight | undefined
  /** The horizon lift at this point of the climb. */
  readonly lift: number
  /** How far the city has sunk at this point of the climb. */
  readonly citySink: number
}

/**
 * A sky plate is the first sky layer when it is a plate: led with, so the light never draws under an opaque picture. Any
 * other layer keeps its place in the list.
 */
function drawingOrder(layers: readonly ResolvedLayer[]): {
  ordered: readonly ResolvedLayer[]
  leading: boolean
} {
  const firstSky = layers.find((layer) => layer.plate === 'sky')
  if (firstSky === undefined || firstSky.extend !== 'plate') return { ordered: layers, leading: false }
  return { ordered: [firstSky, ...layers.filter((layer) => layer !== firstSky)], leading: true }
}

/**
 * The one shift that puts every city strip's starting top below `cityTopMin`. Measured at the start of the climb rather
 * than per frame, so the city still falls away with parallax as the camera climbs instead of being pinned to the line.
 */
function framingSink(layers: readonly ResolvedLayer[], framing: ComposeFraming): number {
  const { cityTopMin, heights } = framing
  if (cityTopMin === undefined || heights === undefined) return 0
  let highest = Number.POSITIVE_INFINITY
  for (const layer of layers) {
    const height = heights[layer.alias]
    if (layer.plate !== 'city' || layer.extend === 'plate' || height === undefined) continue
    highest = Math.min(highest, layer.sink - height)
  }
  return Number.isFinite(highest) ? Math.max(0, cityTopMin - highest) : 0
}

export function composeStage(scenery: Scenery, state: ComposeState): Composition {
  const { cameraY, progress, timeSeconds } = state
  const framing = state.framing ?? {}
  const pixelsPerUnit = framing.pixelsPerUnit ?? 1
  const snap = (value: number): number =>
    pixelsPerUnit > 0 ? Math.round(value * pixelsPerUnit) / pixelsPerUnit : value

  const t = Math.min(1, Math.max(0, progress))
  const lift = scenery.horizonLift * t * t * (3 - 2 * t)
  const citySink = citySinkAt(scenery, t)
  const sunk = framingSink(scenery.layers, framing)

  const { ordered, leading } = drawingOrder(scenery.layers)
  const layers = ordered.map((layer): ComposedLayer => {
    const isPlate = layer.extend === 'plate'
    const plate = isPlate ? 'sky' : layer.plate
    const sink = layer.extend === 'tile' ? layer.sink + SKIRT_HEIGHT : layer.sink
    const composed = { alias: layer.alias, plate, depth: layer.depth, extend: layer.extend, haze: layer.haze }

    let y: number
    if (plate === 'city') {
      // The ascent arc, not the camera, decides where the city stands: undo the camera, keep a small share so a bounce
      // still reads as depth, and drop each layer in proportion to how near it is.
      y = -cameraY + cameraY * layer.depth * CITY_CAMERA_COUPLING + sink + citySink * layer.arc + sunk
    } else {
      y = -cameraY * (1 - layer.depth) + sink
      // A plate stands its foot down with the city on a tall portrait canvas.
      if (isPlate) y += sunk
    }
    y += lift
    if (isPlate) return { ...composed, y, tileX: undefined }

    let tileX = cameraY * layer.depth * 0.2
    if (layer.drift > 0) tileX += timeSeconds * layer.drift
    if (plate === 'city') return { ...composed, y: snap(y), tileX: snap(tileX) }
    return { ...composed, y, tileX }
  })

  const light: ComposedLight | undefined =
    scenery.lightAlias === undefined
      ? undefined
      : {
          alias: scenery.lightAlias,
          y: -scenery.lightHeight - cameraY * (1 - SUN_PARALLAX) + lift,
          scale: SUN_SCALE,
          after: leading ? 1 : 0,
        }
  return { layers, light, lift, citySink }
}
