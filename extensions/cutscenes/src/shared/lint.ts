// The cutscene lint: a script against the
// scene's map, lines, sounds and lamps. Pure and Node-only (it may use `acos` and friends; it is not the sim). It
// plays the script through the director every 0.1 s and checks the frames: the camera inside the map and clear of walls, every actor on the
// floor and clear of walls. Once per script: duration, fades, captions (lines exist, readable, not overlapping), sound and
// lamp keys exist, no shot shorter than a second, no dead air. The original's rules that read its renderer (ceiling, cut-away
// walls, sprite scale, back to camera, solid boxes) return with the renderer. A script may break a rule
// it names in `lintAllow`, with the reason; the lint has one context (the anchors as given), so an allow's `context` is
// not read.
import { createDirector } from './director/director'
import { type PlacedScript, placeScript } from './sim/anchors'
import type { CutsceneScript } from './sim/cutscene.schema'

export interface CutsceneFinding {
  readonly level: 'error' | 'warning'
  readonly rule: string
  readonly cutscene: string
  readonly detail: string
  readonly t?: number | undefined
  /** How many frames or keys it was found at, when folded into one. */
  readonly count?: number | undefined
  /** The door or prop a finding is about, when it is about one. */
  readonly name?: string | undefined
}
/**
 * The floor the lint checks a camera and actors against: where there is floor, and whether a walk is blocked. Sectors'
 * `ResolvedMap` is one; a 2D game builds its own from its level. The lint has no sim context, so it cannot take `Places`.
 */
export interface LintFloor {
  /** Whatever room the point is in, or undefined off the floor. */
  sectorAt(p: { readonly x: number; readonly z: number }): unknown
  /** Whether the segment a→b is blocked within `margin` metres. */
  segmentBlocked(
    a: { readonly x: number; readonly z: number },
    b: { readonly x: number; readonly z: number },
    margin: number,
  ): boolean
}
export interface LintWorld {
  readonly map: LintFloor
  /** 2 for a 2D game: its stage has no lamps, doors or props, and its camera looks at a point. Default 3. */
  readonly dimensions?: 2 | 3 | undefined
  /** The locale's text by line key: a caption's line must have some, and its length sets how long the caption must stay up. */
  readonly text: Readonly<Record<string, string>>
  /** The sound kinds and lamp ids the game has. */
  readonly sounds: ReadonlySet<string>
  readonly lamps: ReadonlySet<string>
  /** The rooms whose doors the level has, and the props it has: the ids a script's `doors` and `props` rows name. */
  readonly doors: ReadonlySet<string>
  readonly props: ReadonlySet<string>
  /** Where an anchor stands for the lint (`player`, `actor:nurse`, a hotspot or a nav node); undefined when the scene lacks it. */
  readonly anchor: (name: string) => { readonly x: number; readonly z: number } | undefined
}

export const MAX_DURATION = 25
export const MAX_CAPTION = 7
export const CAMERA_CLEARANCE = 0.2
/** An actor's centre this near a wall has half a body in it. */
export const WALL_CLEARANCE = 0.15
/** The shortest shot (s), and the longest stretch with nothing said, moving or changing (s). */
export const MIN_SHOT = 1
export const MAX_DEAD = 2
const STEP = 0.1

/** Reading time for a caption: 1.2 s plus 0.06 s a character, or 1 s plus 15 characters a second, whichever is longer, at most `MAX_CAPTION`. */
export const readingTime = (text: string): number => {
  const n = [...text].length
  return Math.min(MAX_CAPTION, Math.max(1.2 + 0.06 * n, 1 + n / 15))
}

const round1 = (t: number): number => Math.round(t * 10) / 10

/** The two keys of an actor either side of `t`. */
function pair<K extends { t: number }>(keys: readonly K[], t: number): [K, K] {
  let i = 0
  while (i < keys.length - 1 && (keys[i + 1] as K).t <= t) i++
  return [keys[i] as K, keys[Math.min(i + 1, keys.length - 1)] as K]
}

export function lintCutscene(script: CutsceneScript, world: LintWorld): CutsceneFinding[] {
  const allowed = new Set((script.lintAllow ?? []).map((a) => a.rule))
  const folded = new Map<string, CutsceneFinding>()
  const add = (
    level: 'error' | 'warning',
    rule: string,
    detail: string,
    t?: number,
    subject = '',
    name?: string,
  ): void => {
    if (allowed.has(rule)) return
    const key = `${rule}|${subject}|${level === 'error' ? '' : detail}`
    const seen = folded.get(key)
    if (seen !== undefined) folded.set(key, { ...seen, count: (seen.count ?? 1) + 1 })
    else
      folded.set(key, {
        level,
        rule,
        cutscene: script.id,
        detail,
        ...(t === undefined ? {} : { t }),
        ...(name === undefined ? {} : { name }),
        count: 1,
      })
  }

  if (script.duration > MAX_DURATION)
    add('error', 'duration', `${script.duration} s; at most ${MAX_DURATION} s`)
  for (const f of script.fade ?? [])
    if (f.value < 0 || f.value > 1) add('error', 'fade', `fade ${f.value} outside [0, 1]`, f.t)
  const captions = [...(script.caption ?? [])].sort((a, b) => a.t - b.t)
  captions.forEach((c, i) => {
    const text = world.text[c.line]
    if (text === undefined) add('error', 'line', `the locale has no text for ${c.line}`, c.t, c.line)
    else {
      const shown = c.until - c.t
      const need = readingTime(text)
      if (shown + 1e-9 < need)
        add(
          'error',
          'reading',
          `"${text}" shown ${shown.toFixed(2)} s, needs ${need.toFixed(2)} s`,
          c.t,
          c.line,
        )
      if (shown > MAX_CAPTION + 1e-9)
        add(
          'error',
          'reading',
          `"${text}" shown ${shown.toFixed(2)} s, at most ${MAX_CAPTION} s`,
          c.t,
          `${c.line}:long`,
        )
    }
    const before = captions[i - 1]
    if (before !== undefined && before.until > c.t + 1e-9)
      add(
        'error',
        'overlap',
        `${c.line} starts before the caption before it ends (${before.until})`,
        c.t,
        c.line,
      )
  })
  for (const s of script.sound ?? [])
    if (!world.sounds.has(s.kind)) add('error', 'sound', `no sound '${s.kind}'`, s.t, s.kind)
  for (const l of script.light ?? [])
    if (!world.lamps.has(l.lamp)) add('error', 'lamp', `no lamp '${l.lamp}' in the scene`, l.t, l.lamp)
  for (const d of script.doors ?? [])
    if (!world.doors.has(d.door))
      add('error', 'door', `no door '${d.door}' in the scene`, d.t, d.door, d.door)
  for (const p of script.props ?? [])
    if (!world.props.has(p.prop))
      add('error', 'prop', `no prop '${p.prop}' in the scene`, p.t, p.prop, p.prop)

  // A 2D stage draws the camera's look-at point, the actors, the cues, the fade and the captions; the rest does nothing there.
  const flat = world.dimensions === 2
  if (flat)
    for (const [name, used] of [
      ['light', script.light],
      ['doors', script.doors],
      ['props', script.props],
      ['time', script.time],
      ['grade', script.grade],
      ['flicker', script.flicker],
    ] as const)
      if (used !== undefined && used.length > 0)
        add(
          'warning',
          '3d-only',
          `This step only works in 3D games. It does nothing here. (${name})`,
          undefined,
          name,
        )

  // Anchors: every one must resolve. An actor that cannot be placed is left out of the frame checks.
  const placed = placeScript(script, world.anchor)
  const missing = placed.ok ? [] : placed.missing
  for (const name of missing) add('error', 'anchor', `no anchor '${name}' in the scene`, undefined, name)
  const settled = placeScript(
    { ...script, actor: (script.actor ?? []).filter((a) => a.at === undefined || !missing.includes(a.at)) },
    world.anchor,
  )
  const play: PlacedScript = settled.ok ? settled.script : { ...script, actor: [] }
  // A 2D level shows its characters where the editor put them. A scene that starts one somewhere else makes it jump when
  // the scene starts and again when it ends, so the person who moved it in the editor is told.
  if (flat) {
    const shown = (n: number): string => String(Math.round(n * 100) / 100)
    for (const who of new Set((play.actor ?? []).map((a) => a.who))) {
      const first = (play.actor ?? []).filter((a) => a.who === who).sort((a, b) => a.t - b.t)[0]
      const home = world.anchor(`actor:${who}`)
      if (first === undefined || home === undefined) continue
      if (Math.hypot(first.x - home.x, first.z - home.z) > 0.01)
        add(
          'warning',
          'start',
          `${who} starts this cutscene at ${shown(first.x)}, ${shown(first.z)} but stands at ${shown(home.x)}, ${shown(home.z)} in the level.`,
          first.t,
          who,
        )
    }
  }
  // Starts no clips: the lint only looks at the frames.
  const director = createDirector(play, () => {})

  // Shots: from each cut (or the start) to the next.
  const starts = [...script.camera].filter((k, i) => i === 0 || k.cut === true).map((k) => Math.max(0, k.t))
  starts.forEach((t, i) => {
    const end = Math.min(script.duration, starts[i + 1] ?? script.duration)
    if (end - t + 1e-9 < MIN_SHOT && director.stateAt(t).fade < 0.98)
      add(
        'error',
        'cut',
        `the shot at ${t} s lasts ${(end - t).toFixed(2)} s; at least ${MIN_SHOT} s`,
        t,
        String(t),
      )
  })

  // Dead air: a stretch with no caption, no cut, nothing moving or fading, no flicker, sound or lamp change.
  const sounds = (script.sound ?? []).map((x) => x.t)
  const lights = (script.light ?? []).map((x) => x.t)
  // A door, a prop, the time of day or the grade changing is something happening, as a state mark is.
  const marks = [
    ...(script.states ?? []),
    ...(script.doors ?? []),
    ...(script.props ?? []),
    ...(script.time ?? []),
    ...(script.grade ?? []),
  ].map((x) => x.t)
  const near = (list: number[], t: number): boolean => list.some((x) => Math.abs(x - t) < 0.5 + 1e-9)
  const live = (t: number): boolean => {
    const f = director.stateAt(t)
    const g = director.stateAt(Math.max(0, t - STEP))
    const moved = Object.keys(f.actors).some((who) => {
      const a = f.actors[who]
      const b = g.actors[who]
      return (
        a !== undefined &&
        b !== undefined &&
        (a.moving ||
          Math.hypot(a.x - b.x, a.z - b.z) > 1e-3 ||
          Math.abs(a.alpha - b.alpha) > 1e-3 ||
          Math.abs(a.facing - b.facing) > 1e-3)
      )
    })
    return (
      f.caption !== null ||
      f.flicker ||
      moved ||
      Math.abs(f.fade - g.fade) > 1e-4 ||
      near(sounds, t) ||
      near(lights, t) ||
      near(marks, t) ||
      starts.some((x) => t >= x && t - x < 1 - 1e-9)
    )
  }
  let from: number | null = null
  for (let i = 0; i * STEP <= script.duration + 1e-9; i++) {
    const t = round1(i * STEP)
    const last = i * STEP > script.duration - STEP / 2
    if (!live(t) && !last) {
      from ??= t
      continue
    }
    if (from !== null && t - from > MAX_DEAD + 1e-9)
      add(
        'error',
        'dead',
        `nothing is said, moves or changes from ${from} s to ${t} s (at most ${MAX_DEAD} s)`,
        from,
        String(from),
      )
    from = null
  }

  // Frames: the camera inside the map and clear of walls; each actor on the floor, clear of walls.
  const keysOf = (who: string) => (play.actor ?? []).filter((a) => a.who === who)
  for (let i = 0; i * STEP <= script.duration + 1e-9; i++) {
    const t = round1(i * STEP)
    const f = director.stateAt(t)
    if (f.fade >= 0.98) continue
    const [x, y, z] = f.camera.pos
    const fmt = `(${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)})`
    // A 2D stage has no camera body to keep clear of walls: it looks at a point.
    if (!flat && world.map.sectorAt({ x, z }) === undefined)
      add('error', 'camera', `camera ${fmt} is outside the map`, t, 'outside')
    else if (!flat && world.map.segmentBlocked({ x, z }, { x, z }, CAMERA_CLEARANCE))
      add('error', 'camera', `camera ${fmt} is within ${CAMERA_CLEARANCE} m of a wall`, t, 'wall')
    for (const who of Object.keys(f.actors)) {
      const a = f.actors[who]
      if (a === undefined || a.alpha < 0.05) continue
      const [k0, k1] = pair(keysOf(who), t)
      if (k0.through === true || k1.through === true) continue
      const at = `${who} at (${a.x.toFixed(2)}, ${a.z.toFixed(2)})`
      if (world.map.sectorAt(a) === undefined) add('error', 'floor', `${at} is off the floor`, t, who)
      // A 2D character's point is where it stands (its feet), so beside a wall is fine; only inside one is wrong.
      else if (world.map.segmentBlocked(a, a, flat ? 0 : WALL_CLEARANCE))
        add(
          'error',
          'wall',
          flat ? `${at} is in a wall` : `${at} is in a wall (within ${WALL_CLEARANCE} m)`,
          t,
          who,
        )
    }
  }
  return [...folded.values()]
}

/** Lints every script; the cutscene each finding is in is on it. */
export function lintCutscenes(scripts: readonly CutsceneScript[], world: LintWorld): CutsceneFinding[] {
  return scripts.flatMap((s) => lintCutscene(s, world))
}
