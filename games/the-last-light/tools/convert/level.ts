// The blockout of the prologue (rooms, walls, masses, boxes, hotspots, lamps, camera zones) as an `af-sector/2` level
// and the interface words its hotspots need. Pure: it reads data and returns text and a report; `convert.ts` writes it.
import { GENERATOR_OF, type PlacedModel, propIds } from './props-table.ts'
import type { Converted, Unexpressed } from './report.ts'

type Json = Record<string, unknown>

/** The level's file name under the game's folder, and the interface catalog the hotspots' English names go into. */
const LEVEL_PATH = 'content/levels/prologue.af-sector.json'
const UI_WORDS_PATH = 'messages/ui/en.json'

/** Hotspots act one's prologue hides: they are not in the new level (the survey, T4). */
const HIDDEN_BY_PROLOGUE: ReadonlySet<string> = new Set(['scratches', 'scrawl', 'puddle'])
/** Hotspots usable only once the supply room door is open. The solver's model reads the same condition. */
const AFTER_SUPPLY_DOOR: ReadonlySet<string> = new Set(['shelf', 'locker'])

/**
 * The old lamp kinds the lamp kit cannot hold, each written as a neon with its own colour (the kit's coloured glow, which may be
 * any colour and any tone). The kit has no screen, fire or spark; its moon and fill are other colours than the old game's, and
 * the builder refuses a lamp whose colour is off its kind's tone, which would leave the room without that light.
 */
const LAMP_KIND_FOR: Readonly<Record<string, string>> = {
  screen: 'neon',
  fire: 'neon',
  spark: 'neon',
  moon: 'neon',
  fill: 'neon',
}

/**
 * What each lamp burns at when the prologue's night begins, the power on: the old clinic's dress levels
 * (`src/scenes/clinic/dress.ts` at 92e6704, the flicker at its mean), then the prologue's own scale-downs
 * (`src/scenes/prologue/dress.ts`: the corridor's bulb and the sconce half gone, the moon at 0.4 and 0.6, the closet's tube dead).
 * The curtains and the spark are not lit yet. A lamp not listed keeps the kit's own level.
 */
const LEVEL_WHEN_NIGHT_BEGINS: Readonly<Record<string, number>> = {
  deskLamp: 1.05,
  monitorGlow: 0.55,
  hallLamp: 0.6,
  wardLamp: 0.5,
  corridorLamp: 0.12,
  exitLamp: 1.25,
  closetLamp: 0,
  moon: 0.34,
  moonCorridor: 0.48,
  wardFill: 1.15,
  bayFill: 0.95,
  sconce: 0.375,
  curtainWest: 0,
  curtainEast: 0,
  spark: 0,
}

const isRecord = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const rows = (value: unknown): readonly Json[] => (Array.isArray(value) ? value.filter(isRecord) : [])

/** A colour as the level writes it: `[r, g, b]` in 0 to 1 as `#rrggbb`. */
function hexOf(color: unknown): string | undefined {
  if (!Array.isArray(color) || color.length < 3) return undefined
  const byte = (v: unknown) => Math.round(Math.max(0, Math.min(1, Number(v))) * 255)
  return `#${[0, 1, 2].map((i) => byte(color[i]).toString(16).padStart(2, '0')).join('')}`
}

/** One wall's member, expanded: a preset's fields written in, `hideFrom` left out (the format cannot say it). */
function wallOf(member: unknown, presets: Json, where: string, report: Unexpressed[]): Json | undefined {
  if (member === undefined) return undefined
  // A bare string names the wall's cut (its shape for the camera's occluder rule).
  const given: Json = typeof member === 'string' ? { cut: member } : isRecord(member) ? { ...member } : {}
  const preset = typeof given.preset === 'string' ? given.preset : undefined
  const base = preset !== undefined && isRecord(presets[preset]) ? { ...(presets[preset] as Json) } : {}
  delete given.preset
  const wall: Json = { ...base, ...given }
  if (wall.hideFrom !== undefined) {
    report.push({
      kind: 'wall-member',
      where,
      what: `hideFrom ${JSON.stringify(wall.hideFrom)}: the level format has no per-room wall hiding; the rooms a view draws say it`,
      did: 'dropped',
    })
    delete wall.hideFrom
  }
  return Object.keys(wall).length === 0 ? undefined : wall
}

/** A loop of corners with each wall expanded. */
function cornersOf(corners: unknown, presets: Json, where: string, report: Unexpressed[]): unknown[] {
  return (Array.isArray(corners) ? corners : []).map((corner, index) => {
    const [x, z, member] = corner as [number, number, unknown]
    const wall = wallOf(member, presets, `${where}, corner ${index + 1}`, report)
    return wall === undefined ? [x, z] : [x, z, wall]
  })
}

/** The camera zones as views: each room of a zone names it. */
function viewsOf(zones: readonly Json[], report: Unexpressed[]): Json {
  const views: Json = {}
  for (const zone of zones) {
    const { id, figureFill, enter, area, ...numbers } = zone
    if (typeof id !== 'string') continue
    if (figureFill !== undefined)
      report.push({
        kind: 'camera',
        where: id,
        what: `figureFill ${String(figureFill)}: the figures are lit by the room now`,
        did: 'dropped',
      })
    if (enter !== undefined)
      report.push({
        kind: 'camera',
        where: id,
        what: 'enter (shift on entering the zone): the views carry an enter margin instead',
        did: 'dropped',
      })
    if (area !== undefined)
      report.push({
        kind: 'camera',
        where: id,
        what: 'area (the zone’s bounds in x and z): the room it names says where it holds',
        did: 'dropped',
      })
    views[id] = numbers
  }
  return views
}

/** One lamp, in the lamp kit's kinds. */
function lampOf(lamp: Json, report: Unexpressed[]): Json {
  const kind = String(lamp.kind)
  const mapped = LAMP_KIND_FOR[kind]
  if (mapped !== undefined)
    report.push({
      kind: 'lamp-kind',
      where: String(lamp.id),
      what: `the kit has no "${kind}" of the old game's colour; written as a "${mapped}" with its own colour`,
      did: 'approximated',
    })
  // The level says where on the floor first, then how high: `[x, z, height]`, where the old game's lamp had `x, y (height), z`.
  const out: Json = { id: lamp.id, kind: mapped ?? kind, at: [lamp.x, lamp.z, lamp.y] }
  const level = LEVEL_WHEN_NIGHT_BEGINS[String(lamp.id)]
  if (level !== undefined) out.level = level
  // The old lamp's `radius` is its gameplay pool (where the creature counts as in light), not its range; the level keeps it
  // beside the lamp as a field the render ignores and the lamp feature reads.
  if (typeof lamp.radius === 'number' && lamp.radius > 0) {
    out.radius = lamp.radius
    report.push({
      kind: 'lamp-radius',
      where: String(lamp.id),
      what: `pool radius ${lamp.radius} m kept as the lamp's \`radius\` (the gameplay light; the render uses range)`,
      did: 'approximated',
    })
  }
  const color = hexOf(lamp.color)
  if (color !== undefined) out.color = color
  if (typeof lamp.range === 'number') out.range = lamp.range
  return out
}

/** A hotspot, as an entity of the level: where, how near, its name as a key, and when it can be used. */
function hotspotOf(spot: Json): Json {
  const id = String(spot.id)
  const entity: Json = {
    def: 'hotspot',
    id,
    x: spot.x,
    z: spot.z,
    y: spot.y,
    reach: spot.reach,
    name: `hotspot.${id}`,
  }
  if (spot.hide === true) entity.hide = true
  if (AFTER_SUPPLY_DOOR.has(id)) entity.when = [{ fact: 'closetOpen', is: true }]
  return entity
}

/** A model placed again: a library generator of its own kind, or a plain box of its size when none draws it. */
function propsOf(models: readonly PlacedModel[], report: Unexpressed[]): Json[] {
  const ids = propIds(models)
  return models.map((model, index) => {
    const id = ids[index] as string
    const at = model.y === undefined || model.y === 0 ? [model.x, model.z] : [model.x, model.z, model.y]
    const prop: Json = { id, at }
    const generator = GENERATOR_OF[model.file]
    if (generator !== undefined) prop.use = generator
    else {
      prop.kind = 'box'
      prop.with = { size: [...model.size] }
      report.push({
        kind: 'prop',
        where: id,
        what: `no generator draws "${model.file}"; written as a box of its size`,
        did: 'approximated',
      })
    }
    if (model.yaw !== undefined && model.yaw !== 0) prop.angle = Math.round((model.yaw * 180) / Math.PI)
    return prop
  })
}

/**
 * The blockout as `af-sector/2`, with the hotspots as entities and their English names as the interface catalog's
 * keys (`hotspot.<id>`), as the old game wrote them.
 */
export function convertLevel(blockout: unknown, props: readonly PlacedModel[]): Converted {
  const root = isRecord(blockout) ? blockout : {}
  const report: Unexpressed[] = []
  const presets = isRecord(root.walls) ? root.walls : {}
  const views = viewsOf(rows(root.zones), report)
  const zoneHasView = (zone: unknown): zone is string =>
    typeof zone === 'string' && Object.hasOwn(views, zone)

  const sectors = rows(root.rooms).map((room) => {
    const { corners, holes, zone, ...rest } = room
    const where = `room ${String(room.id)}`
    const sector: Json = { ...rest, corners: cornersOf(corners, presets, where, report) }
    if (zone !== undefined) sector.zone = zone
    if (zoneHasView(zone)) sector.view = zone
    if (Array.isArray(holes))
      sector.holes = holes.map((hole, i) => cornersOf(hole, presets, `${where}, hole ${i + 1}`, report))
    return sector
  })

  const spots = rows(root.hotspots)
  const kept = spots.filter((spot) => !HIDDEN_BY_PROLOGUE.has(String(spot.id)))
  for (const spot of spots)
    if (HIDDEN_BY_PROLOGUE.has(String(spot.id)))
      report.push({
        kind: 'hotspot',
        where: String(spot.id),
        what: "act one's hotspot that the prologue hides",
        did: 'dropped',
      })
  for (const spot of kept)
    if (typeof spot.on === 'string')
      report.push({
        kind: 'hotspot',
        where: String(spot.id),
        what: `on "${spot.on}": a hotspot stands where it is, not on a box`,
        did: 'dropped',
      })

  const spawn = isRecord(root.spawn) ? root.spawn : { x: 0, z: 0 }
  const level: Json = {
    format: 'af-sector/2',
    name: 'prologue',
    title: 'The prologue',
    sectors,
    ...(Array.isArray(root.masses) ? { masses: root.masses } : {}),
    props: propsOf(props, report),
    lamps: rows(root.lamps).map((lamp) => lampOf(lamp, report)),
    views,
    entityDefs: [
      {
        id: 'hotspot',
        shape: 'point',
        fields: [
          { id: 'reach', type: 'float', default: 1.4 },
          { id: 'name', type: 'text' },
          { id: 'hide', type: 'bool', default: false },
        ],
      },
      { id: 'spawn', shape: 'point', single: true, fields: [{ id: 'facing', type: 'angle', default: 0 }] },
    ],
    entities: [
      {
        def: 'spawn',
        id: 'spawn',
        x: spawn.x,
        z: spawn.z,
        facing: Math.round((Number(spawn.facing ?? 0) * 180) / Math.PI),
      },
      ...kept.map(hotspotOf),
    ],
  }
  if (root.bounce !== undefined)
    report.push({
      kind: 'bounce',
      where: 'level',
      what: 'the bounce points of the old baked light: the lit room bakes its own',
      did: 'dropped',
    })

  const words = Object.fromEntries(kept.map((spot) => [`hotspot.${String(spot.id)}`, String(spot.name)]))
  return {
    files: {
      [LEVEL_PATH]: `${JSON.stringify(level, null, 2)}\n`,
      [UI_WORDS_PATH]: `${JSON.stringify(words, null, 2)}\n`,
    },
    report,
  }
}
