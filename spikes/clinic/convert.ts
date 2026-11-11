// Spike clinic: converts the source game's clinic into AF data, once, from a local checkout of the source game (read only;
// nothing of it is copied). It reads the clinic's own data files (the sector map, the level's lamps and bounce points, the
// furniture placements, the camera zones and the visibility policy), turns them into
//   content/clinic.af-sector.json     the level (`af-sector/2`): sectors, masses, props, lamps, bounce points, views
//   content/clinic.library.json       the swatches and prop presets the level names
//   content/clinic.opening-state.json the piece states of the opening: the lamp levels with the power out
// and writes only those. The source game's code is never run: each data file is read as text, its imports are swapped for
// stubs, its types are stripped, and the data is imported from that.
//
//   node spikes/clinic/convert.ts <source checkout> [out dir]     (a checkout at 92e6704, as every conversion was made)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { join } from 'node:path'
import { DUEL_RAMP_NAMES, DUEL_RAMPS, nearestDuel } from '../../packages/content/src/shared/palette/duel.ts'
import { DRESSING, DRESSING_SWATCHES } from './dressing.ts'
import { FURNITURE_SWATCHES, REPLACEMENTS } from './furniture.ts'

const source = process.argv[2]
if (source === undefined) throw new Error('usage: node spikes/clinic/convert.ts <source checkout> [out dir]')
const out = process.argv[3] ?? join(import.meta.dirname, 'content')
const scene = (file: string): string => join(source, 'src/scenes/clinic', file)

type Json = Record<string, unknown>
const deps: Record<string, Record<string, unknown>> = {}
;(globalThis as unknown as { __deps: typeof deps }).__deps = deps

/** A data file of the source game as a module: type-only imports dropped, value imports taken from `stubs`. */
async function load(file: string, stubs: Record<string, Record<string, unknown>> = {}): Promise<Json> {
  const text = readFileSync(scene(file), 'utf8')
    .replace(/^import type .*$/gm, '')
    .replace(
      /^import \{([^}]*)\} from '([^']+)';?$/gm,
      (_all, names: string, from: string) => `const {${names}} = globalThis.__deps[${JSON.stringify(from)}];`,
    )
  Object.assign(deps, stubs)
  const js = stripTypeScriptTypes(text)
  return (await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)) as Json
}

const map = await load('map.ts')
const level = await load('level.ts', { '../../render/look': { lamp: (kind: string, spec: Json) => ({ ...spec, kind }) } })
const props = await load('props.ts', { './level': level })
const visibility = await load('visibility.ts')

// --- sectors ------------------------------------------------------------------------------------------------------
// The source's trim for a wall nothing else says anything about: skirting, wainscot and rail, and a top on every wall (`cap`).
// A top goes with its wall when a camera zone or the occluder rule cuts the wall away (the top carries the wall's `line` and
// `cut`, so room visibility's wall hider hides it in the same group).
const DEFAULT_TRIM = { skirting: 0.14, wainscot: 1.14, rail: 0.08, cap: true }
const round = (n: number): number => Math.round(n * 1e6) / 1e6

// The source's floor and its dimmer twin are tile grids (a 30 cm glaze with a dark grout line); the kit's `tileFloor` is that.
// Its tile is found by the swatch's name, so the level names it outright.
const tiled = (name: unknown): unknown => (name === 'floor' || name === 'floorDim' ? 'tileFloor' : name)
const sectors = (map.SECTORS as Json[]).map((s) => ({
  ...s,
  // Every room says its surfaces and its trim outright: AF has no hidden defaults to lean on.
  floorTexture: tiled(s.floorTexture ?? 'floor'),
  ceilingTexture: s.ceilingTexture ?? 'ceiling',
  wallTexture: s.wallTexture ?? 'plaster',
  trim: { ...DEFAULT_TRIM, ...((s.trim as Json | undefined) ?? {}) },
  view: s.zone,
}))

// --- the camera zones, and the play spots the frames are taken at ------------------------------------------------------
const views: Record<string, Json> = {}
for (const zone of level.ZONES as Json[]) {
  const { id, contains: _contains, enter: _enter, ...rest } = zone as Json & { id: string }
  // AF authors a zone's `x` skew for heading 0 and a player starts at the home heading, half a turn on, so the skew is
  // mirrored about the look to land where the source's camera stands.
  const look = rest.look as number[] | undefined
  const x = typeof rest.x === 'number' && look !== undefined ? round(2 * look[0] - rest.x) : rest.x
  views[id] = { ...rest, ...(x === undefined ? {} : { x }), enterMargin: 0.25 }
}
// `shoot.mjs`'s places: where she stands and which way she faces (radians in the source; degrees here).
const SPOTS: Record<string, [number, number, number]> = {
  hall: [0, 3.2, Math.PI],
  ward: [-2.6, 2.6, Math.PI],
  corridor: [0, -3.0, Math.PI],
  supply: [3.0, -4.2, Math.PI / 2],
}
for (const [name, [x, z, yaw]] of Object.entries(SPOTS)) views[`spot-${name}`] = { at: [x, z], yaw: round((yaw * 180) / Math.PI), ...(name === 'supply' ? { doorOpen: true } : {}) }

// --- lamps and bounce points ------------------------------------------------------------------------------------------
const hex = (c: number): string => Math.round(c * 255).toString(16).padStart(2, '0')
const lamps = (level.LAMPS as (Json & { id: string; kind: string; x: number; y: number; z: number; range: number; radius: number; color: number[] })[]).map((l) => ({
  id: l.id,
  kind: l.kind,
  at: [l.x, l.z, l.y],
  range: l.range,
  radius: l.radius,
  color: `#${l.color.map(hex).join('')}`,
}))
const bounce = level.BOUNCE as number[][]

// The lamp levels of the opening: the power out, no fire, no alarm, every flicker at its "reduce flashing" calm of 0.78.
const CALM = 0.78
const openingLamps: Record<string, { level: number }> = {
  deskLamp: { level: 1.05 * CALM },
  monitorGlow: { level: 0.55 },
  hallLamp: { level: 0.1 },
  wardLamp: { level: 0.12 },
  corridorLamp: { level: 0.3 * CALM },
  exitLamp: { level: 0.95 * Math.min(1, CALM + 0.2) },
  closetLamp: { level: 0 },
  moon: { level: 0.85 },
  moonCorridor: { level: 0.8 },
  wardFill: { level: 1.15 },
  bayFill: { level: 0.95 },
  sconce: { level: 0.75 * CALM },
  curtainWest: { level: 0 },
  curtainEast: { level: 0 },
  spark: { level: 0 },
}
for (const value of Object.values(openingLamps)) value.level = round(value.level)

// --- props ---------------------------------------------------------------------------------------------------------------
interface Spec {
  file: string
  x: number
  z: number
  y?: number
  yaw?: number
  size: [number, number, number]
  uniform?: boolean
  mirror?: boolean
  wall?: string
  ceiling?: boolean
  gain?: number
}
const count: Record<string, number> = {}
const placed = (props.PROPS as Spec[]).map((spec) => {
  const n = (count[spec.file] = (count[spec.file] ?? 0) + 1)
  const yaw = spec.yaw ?? 0
  // A quarter turn swaps width and depth: the source's size is the box in the world, AF's is the prop's own.
  const quarter = Math.round(Math.abs(Math.sin(yaw))) === 1
  const [w, h, d] = spec.size
  return {
    id: `${spec.file}-${n}`,
    use: `model.${spec.file}`,
    at: [spec.x, spec.z, ...(spec.y === undefined ? [] : [round(spec.y)])],
    // The source's yaw 0 faces +z and π/2 faces +x; AF's angle is degrees clockwise from east, 90 facing south (+z).
    angle: round(90 - (yaw * 180) / Math.PI),
    with: {
      size: quarter ? [d, h, w] : [w, h, d],
      ...(spec.uniform === true ? { uniform: true } : {}),
      ...(spec.mirror === true ? { mirror: true } : {}),
      ...(spec.wall === undefined ? {} : { wall: spec.wall }),
      ...(spec.ceiling === true ? { ceiling: true } : {}),
      ...(spec.gain === undefined ? {} : { gain: spec.gain }),
    },
  }
})

// --- swatches ----------------------------------------------------------------------------------------------------------
// Each surface the clinic names, as the DUEL colour its texture is mostly made of (the source paints its tiles in DUEL
// colours, so the dominant colour is an exact palette entry): a step of a ramp, as every AF swatch is. No step is lifted: the
// source's `mat(color, texture, 4.8)` is the texture's repeat in metres, not a gain.
const DOMINANT: Record<string, string> = {
  plaster: '#47655a',
  plasterWarm: '#47655a',
  ceiling: '#aea189',
  ceilingTile: '#ccc3b1',
  trimWhite: '#2f3f38',
  cap: '#857565',
  kick: '#1d1d21',
  counterFront: '#7e6144',
  counterTop: '#ccc3b1',
  chrome: '#abaebe',
  skirting: '#2d3136',
  wainscot: '#ccc3b1',
  rail: '#2f3f38',
  glassDay: '#2d4b47',
  glassNight: '#2d4b47',
  prop: '#73737f',
}
const swatches: Record<string, Json> = {}
for (const [name, colour] of Object.entries(DOMINANT)) {
  const index = nearestDuel(colour)
  const step = index % 8
  swatches[name] = { ramp: DUEL_RAMP_NAMES[Math.floor(index / 8)], step, ...(name.startsWith('glass') ? { noCast: true } : {}) }
}
// The moon's glass glows, flat in any light.
swatches.moonGlass = { ...(() => { const i = nearestDuel('#96b2d9'); return { ramp: DUEL_RAMP_NAMES[Math.floor(i / 8)], step: i % 8 } })(), emit: true, flat: true, noCast: true }
if (DUEL_RAMPS.length !== DUEL_RAMP_NAMES.length) throw new Error('the palette and its names disagree')

const presets: Record<string, Json> = {}
for (const file of new Set((props.PROPS as Spec[]).map((p) => p.file)))
  if (REPLACEMENTS[file] === undefined) presets[`model.${file}`] = { kind: 'model', model: `models/${file}.glb`, swatch: 'prop' }

// The dressing's presets and the swatches they and their generators name come from the world kit's own library, as they are
// (the clinic's own surfaces keep their names: a kit swatch of the same name is not taken over them).
const kitLibrary = (name: string): Record<string, Json> => JSON.parse(readFileSync(new URL(`../../extensions/world-kit/library/${name}.json`, import.meta.url), 'utf8'))
const kitProps = kitLibrary('props')
const kitSwatches = kitLibrary('swatches')
// The kit's tile floor sits at step 5 of its ramp; the clinic's floor is the source's dim glaze, so it takes step 3, which puts the
// hall frame's mean (34, 40, 35) nearest the source baseline's (26, 32, 31); step 5 gave (42, 48, 44).
swatches.tileFloor = { ...(kitSwatches.tileFloor as Json), step: 3 }
for (const use of new Set(DRESSING.map((place) => place.use))) {
  const preset = kitProps[use]
  if (preset === undefined) throw new Error(`the world kit has no preset "${use}"`)
  presets[use] = preset
}

/** Every swatch name a preset's parameters carry (a bare name, or a tile of one), that the kit's library has. */
function swatchesIn(value: unknown, found = new Set<string>()): Set<string> {
  if (typeof value === 'string') {
    if (kitSwatches[value] !== undefined) found.add(value)
  } else if (Array.isArray(value)) for (const v of value) swatchesIn(v, found)
  else if (value !== null && typeof value === 'object') for (const v of Object.values(value)) swatchesIn(v, found)
  return found
}
// A stand-in box becomes the kit's own piece of furniture, built by `fit` at the same box: the kit's preset (less its light,
// which the level's own lamps already give) goes in as `with.with`, so the level carries the numbers and `fit` only the shape.
const furnitureSwatches = new Set(FURNITURE_SWATCHES)
const furnished = placed.map((prop) => {
  const file = prop.use.slice('model.'.length)
  const replacement = REPLACEMENTS[file]
  if (replacement === undefined) return prop
  const preset = kitProps[replacement.use]
  if (preset === undefined) throw new Error(`the world kit has no preset "${replacement.use}"`)
  const { kind, light: _light, ...own } = preset as Json & { kind: string }
  for (const name of swatchesIn({ ...own, ...replacement.with })) furnitureSwatches.add(name)
  return {
    id: prop.id,
    use: 'fit',
    at: prop.at,
    angle: prop.angle,
    with: { of: kind, with: { ...own, ...replacement.with }, size: prop.with.size, ...(replacement.turn === undefined ? {} : { turn: replacement.turn }) },
  }
})
presets.fit = kitProps.fit as Json
for (const name of new Set([...DRESSING_SWATCHES, ...furnitureSwatches])) {
  if (swatches[name] !== undefined) continue
  const swatch = kitSwatches[name]
  if (swatch === undefined) throw new Error(`the world kit has no swatch "${name}"`)
  swatches[name] = swatch
}

// --- the level -----------------------------------------------------------------------------------------------------------
const clinic = {
  format: 'af-sector/2',
  name: 'clinic',
  title: 'St. Agnes Clinic',
  sectors,
  masses: map.MASSES,
  props: [...furnished, ...DRESSING],
  lamps,
  bounce,
  // The source's room light: a cool teal-grey ambient (its look bible's `LIGHT.ambient` is 0.15; AF's flat swatches need more) and a low cool fill on
  // upright surfaces, over AF's night.
  time: {
    preset: 'night',
    label: 'Clinic night',
    // The haze is the source's view fog (its `LOOK.haze`, colour 0x4b5a56, full at its far end); its distance band is the look's (scene.ts).
    scene: { light: { shadow: false, ambient: { level: 0.15, tint: '#d6f7fa' }, fill: { level: 0.08, tint: '#c7f2ff' } }, haze: { colour: '#4b5a56', amount: 0.5 } },
  },
  views,
  // Which rooms each camera zone shows and which masses belong to which rooms: stored as the source wrote it, for the room
  // visibility extension to read.
  visibility: visibility.CLINIC_VISIBILITY,
}

mkdirSync(out, { recursive: true })
const write = (name: string, data: unknown): void => writeFileSync(join(out, name), `${JSON.stringify(data, null, 2)}\n`)
write('clinic.af-sector.json', clinic)
write('clinic.library.json', { swatches, props: presets })
write('clinic.opening-state.json', { lamps: openingLamps })
console.log(
  `wrote ${sectors.length} sectors, ${(map.MASSES as unknown[]).length} masses, ${furnished.filter((p) => p.use === 'fit').length} fitted and ${furnished.filter((p) => p.use !== 'fit').length} stand-in props and ${DRESSING.length} dressing props, ${lamps.length} lamps, ${bounce.length} bounce points, ${Object.keys(views).length} views, ${Object.keys(swatches).length} swatches to ${out}`,
)
