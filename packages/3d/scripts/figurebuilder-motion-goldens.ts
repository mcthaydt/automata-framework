// Writes (or checks) the FigureBuilder motion goldens that the motion tests compare against
// (src/tests/fixtures/__goldens__/figurebuilder-motion.json): FigureBuilder's own `base()`, `evaluate()`, item holds,
// `standHolds` and hair spring, each world pose fingerprinted by src/testing/motion-fingerprint.ts. M3.5c plan,
// decision 9.
//
// Run with Node 24 from the repository root, on a FigureBuilder checkout (mcthaydt/FigureBuilder at a1f7246):
//
//   node packages/3d/scripts/figurebuilder-motion-goldens.ts /path/to/FigureBuilder           # writes
//   node packages/3d/scripts/figurebuilder-motion-goldens.ts /path/to/FigureBuilder --check   # compares
//
// As scripts/figurebuilder-goldens.ts: FigureBuilder's src/ (and the AF testing files this needs) are copied to a
// temp folder with `.ts` added to relative imports and an attribute to JSON ones. FigureBuilder runs with
// `view: 0` and no `lookUp` or `pitch` (the sprite cheats AF cuts); its library ids are camelCase, AF's kebab.
// The hair spring is `Figure.prototype.swingHair` called on a stand-in `this` holding only the fields it reads.

import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const here = import.meta.dirname
const GOLDEN = join(here, '../tests/fixtures/__goldens__/figurebuilder-motion.json')
const [source, flag] = process.argv.slice(2)
if (!source) {
  console.error('usage: node figurebuilder-motion-goldens.ts <FigureBuilder checkout> [--check]')
  process.exit(2)
}

const tsFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? tsFiles(path) : path.endsWith('.ts') ? [path] : []
  })
const loadable = (path: string) =>
  writeFileSync(
    path,
    readFileSync(path, 'utf8')
      .replace(/(from '\.{1,2}\/[^']+?)(?<!\.json)'/g, "$1.ts'")
      .replace(/(from '\.{1,2}\/[^']+\.json')/g, "$1 with { type: 'json' }"),
  )
type State = Record<string, unknown>
type World = number[][]

const temp = mkdtempSync(join(tmpdir(), 'figurebuilder-motion-goldens-'))
try {
  cpSync(join(source, 'src'), join(temp, 'fb'), { recursive: true })
  for (const file of ['golden-outfits.ts', 'fixture-sliders.ts', 'motion-fingerprint.ts', 'motion-states.ts'])
    cpSync(join(here, '../src/testing', file), join(temp, 'af', file))
  for (const file of [...tsFiles(join(temp, 'fb')), ...tsFiles(join(temp, 'af'))]) loadable(file)
  const load = (path: string) => import(pathToFileURL(join(temp, path)).href)
  const { dress, GROUP, SWATCHES } = await load('fb/render/figure/garments.ts')
  const { measure } = await load('fb/render/figure/genes.ts')
  const { skeleton, J } = await load('fb/render/figure/rig.ts')
  const { PPM } = await load('fb/render/figure/hair.ts')
  const { reach } = await load('fb/render/figure/parts.ts')
  const { base, evaluate, standHolds } = await load('fb/render/figure/motion.ts')
  const { GAITS, POSES, ITEMS } = await load('fb/render/figure/cast.ts')
  const { Figure } = await load('fb/render/figure/figure.ts')
  const { GOLDEN_OUTFITS } = await load('af/golden-outfits.ts')
  const { motionFingerprint } = await load('af/motion-fingerprint.ts')
  const { GOLDEN_STATES, GOLDEN_SOME_STATES } = await load('af/motion-states.ts')

  const camel = (v: unknown): unknown =>
    typeof v === 'string'
      ? v.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())
      : Array.isArray(v)
        ? v.map(camel)
        : v && typeof v === 'object'
          ? Object.fromEntries(
              Object.entries(v).map(([k, x]) => [k, k === 'style' && typeof x === 'object' ? x : camel(x)]),
            )
          : v
  const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)
  const swatches = new Proxy(SWATCHES, { get: (t, name: string) => t[name] ?? t.black })
  const round = (x: unknown): unknown =>
    typeof x === 'number'
      ? Number(x.toPrecision(12))
      : Array.isArray(x)
        ? x.map(round)
        : x && typeof x === 'object'
          ? Object.fromEntries(Object.entries(x).map(([k, v]) => [k, round(v)]))
          : x
  const print = (world: World) => round(motionFingerprint(world))
  /** FigureBuilder's state for an AF golden state: its sprite cheats off. */
  const fb = (state: State): State => ({ ...state, view: 0 })
  const stateOf = (label: string): State => {
    const state = GOLDEN_STATES[label]
    if (!state) throw new Error(`no golden state ${label}`)
    return state
  }

  const bodies: Record<string, Record<string, unknown>> = {}
  const holds: Record<string, unknown> = {}
  const named = { wick: GOLDEN_OUTFITS[0], keeper: GOLDEN_OUTFITS[1] }
  const own: Record<string, string> = { wick: 'bounce', keeper: 'elderly' }
  for (const [id, outfit] of Object.entries(named) as [string, { sliders: unknown }][]) {
    const s = skeleton(measure(outfit.sliders).genes)
    const body: Record<string, unknown> = {}
    for (const gait of Object.keys(GAITS)) {
      const labels = kebab(gait) === own[id] ? Object.keys(GOLDEN_STATES) : GOLDEN_SOME_STATES
      for (const label of labels)
        body[`${kebab(gait)} ${label}`] = print(base(s, GAITS[gait], fb(stateOf(label))).world)
    }
    for (const [name, stand] of Object.entries(POSES))
      body[`stand ${kebab(name)}`] = print(
        evaluate(s, GAITS.bounce, fb({ ...stateOf('idle 0'), yaw: 0, t: 0.4, stand })).world,
      )
    bodies[id] = body
    for (const [item, def] of Object.entries(ITEMS) as [
      string,
      { hold: (s: unknown, side: string) => unknown },
    ][])
      for (const side of ['L', 'R'])
        for (const label of GOLDEN_SOME_STATES) {
          const hold = def.hold(s, side)
          holds[`${id} ${kebab(item)} ${side} ${label}`] = {
            hold: round(hold),
            world: print(evaluate(s, GAITS.strut, fb({ ...stateOf(label), hold })).world),
          }
        }
  }

  const stands: Record<string, unknown> = {}
  for (const o of GOLDEN_OUTFITS as { name: string; sliders: unknown; skin: string; garments: unknown }[]) {
    const m = measure(o.sliders)
    const s = skeleton(m.genes)
    const look = dress(m, s, camel(o.skin), camel(o.garments), swatches, PPM)
    const skip = [GROUP.head, GROUP.armL, GROUP.armR, GROUP.item]
    const cloth = look.parts.filter((p: { group: number }) => !skip.includes(p.group))
    const surface = (origin: number[], dir: number[]) => reach(cloth, s.rest, origin, dir)
    for (const [name, stand] of Object.entries(POSES)) {
      const placed = standHolds(s, stand, surface, look.anchors)
      const world = evaluate(
        s,
        GAITS.loose,
        fb({ ...stateOf('idle 0'), yaw: 0, stand, holds: placed, clear: [0.1, 0.2] }),
      ).world
      stands[`${o.name} ${kebab(name)}`] = {
        holds: round(placed.map((h: Record<string, unknown>) => ({ ...h, anchor: h.anchor ?? null }))),
        world: print(world),
      }
    }
  }

  // The hair spring over 40 steps: standing, walking, turning, at mixed frame times.
  const hair: unknown[] = []
  {
    const keeper = skeleton(measure(named.keeper?.sliders).genes)
    const gait = GAITS.elderly
    const dynamics = { stiff: 60, damp: 9, trail: 0.25, bounce: 0.06, sway: 1, hang: 0.5 }
    const self = {
      member: { hair: dynamics, gait, genes: { ...keeper.genes, headTilt: 0.05 } },
      hairState: { pitch: 0, roll: 0, vPitch: 0, vRoll: 0 },
      shown: 0,
      lastShown: null as number | null,
      world: [] as World,
      relativeYaw: 0,
      phase: 0,
    }
    for (let i = 0; i < 40; i++) {
      const dt = [1 / 60, 1 / 30, 0.05, 1 / 144][i % 4] ?? 0
      const moving = i >= 8 && i < 26
      self.phase = (i * 0.07) % 1
      if (i >= 18) self.shown = Math.min(1.2, (i - 17) * 0.15)
      self.world =
        i >= 4
          ? base(
              keeper,
              gait,
              fb({ ...stateOf('idle 0'), moving, phase: self.phase, yaw: self.shown, t: i * 0.05 }),
            ).world
          : []
      self.relativeYaw = self.shown
      const before = { ...self.hairState }
      const lastShown = self.lastShown
      Figure.prototype.swingHair.call(self, dt, { facing: self.shown, moving })
      hair.push({
        dt,
        moving,
        yawRate: lastShown === null ? 0 : (self.shown - lastShown) / dt,
        phase: self.phase,
        shown: self.shown,
        head: self.world[J.head] ?? null,
        before,
        after: { ...self.hairState },
      })
    }
  }

  // One state per line, so a diff names the state that moved.
  const section = (entries: Record<string, unknown>, indent: string) =>
    Object.entries(entries).map(
      ([key, value], n, all) =>
        `${indent}${JSON.stringify(key)}: ${JSON.stringify(value)}${n < all.length - 1 ? ',' : ''}`,
    )
  const lines = ['{', '  "bodies": {']
  Object.entries(bodies).forEach(([id, body], n, all) => {
    lines.push(
      `    ${JSON.stringify(id)}: {`,
      ...section(body as Record<string, unknown>, '      '),
      `    }${n < all.length - 1 ? ',' : ''}`,
    )
  })
  lines.push(
    '  },',
    '  "stands": {',
    ...section(stands, '    '),
    '  },',
    '  "holds": {',
    ...section(holds, '    '),
    '  },',
  )
  lines.push(`  "hair": ${JSON.stringify(round(hair))}`, '}')
  const text = `${lines.join('\n')}\n`
  if (flag === '--check') {
    const want = JSON.parse(readFileSync(GOLDEN, 'utf8'))
    const got = JSON.parse(text)
    let misses = 0
    for (const part of ['bodies', 'stands', 'holds', 'hair'] as const) {
      const same = JSON.stringify(got[part]) === JSON.stringify(want[part])
      if (!same) misses++
      console.log(`${part}: ${same ? 'same' : 'DIFFERS'}`)
    }
    process.exit(misses ? 1 : 0)
  }
  writeFileSync(GOLDEN, text)
  console.log(
    `wrote ${Object.keys(stands).length} stands, ${Object.keys(holds).length} holds, ${hair.length} hair steps to ${GOLDEN}`,
  )
} finally {
  rmSync(temp, { recursive: true, force: true })
}
