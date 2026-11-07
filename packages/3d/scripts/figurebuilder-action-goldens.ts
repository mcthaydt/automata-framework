// Writes the action goldens (src/tests/fixtures/__goldens__/figurebuilder-actions.json): FigureBuilder's own `reach`,
// `look` and `flinch` end poses on Wick's body, which the fixture clips (`figure-clips/{reach,look,flinch}.toml`)
// must match within 1e-3 figure units (M3 spec §4.4.4, F-g; M3.6d plan, decision 13). It also prints the numbers
// those clips are written from: the neck's and head's local turns equal to FigureBuilder's change of its head
// angles, the flinch's pelvis and right foot, and the reach's and flinch's hand targets.
//
//   node packages/3d/scripts/figurebuilder-action-goldens.ts /path/to/FigureBuilder           # writes
//   node packages/3d/scripts/figurebuilder-action-goldens.ts /path/to/FigureBuilder --check   # compares
//
// FigureBuilder (mcthaydt/FigureBuilder) at a1f7246; it runs on Node 24's type stripping from a temp copy whose
// relative imports are given their `.ts`, as figurebuilder-motion-goldens.ts does.

import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const here = import.meta.dirname
const GOLDEN = join(here, '../tests/fixtures/__goldens__/figurebuilder-actions.json')
const [source, flag] = process.argv.slice(2)
if (!source) {
  console.error('usage: node figurebuilder-action-goldens.ts <FigureBuilder checkout> [--check]')
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
type Q = [number, number, number, number]
interface Evaluated {
  world: number[][]
  pose: { rot: Q[] }
}

const temp = mkdtempSync(join(tmpdir(), 'figurebuilder-action-goldens-'))
try {
  cpSync(join(source, 'src'), join(temp, 'fb'), { recursive: true })
  for (const file of ['testing/fixture-sliders.ts', 'math/math.ts', 'solve/rotation.ts'])
    cpSync(join(here, '../src', file), join(temp, 'af', file))
  for (const file of [...tsFiles(join(temp, 'fb')), ...tsFiles(join(temp, 'af'))]) loadable(file)
  const load = (path: string) => import(pathToFileURL(join(temp, path)).href)
  const { measure } = await load('fb/render/figure/genes.ts')
  const { skeleton, J } = await load('fb/render/figure/rig.ts')
  const { evaluate } = await load('fb/render/figure/motion.ts')
  const { GAITS } = await load('fb/render/figure/cast.ts')
  const { qconj, qmul } = await load('fb/render/figure/math.ts')
  const { WICK_SLIDERS } = await load('af/testing/fixture-sliders.ts')
  const { eulerOf } = await load('af/solve/rotation.ts')

  const s = skeleton(measure(WICK_SLIDERS).genes)
  const gait = GAITS.bounce
  const k = s.genes.height / 1.62
  // Standing at t 0, facing +z, the sprite cheats off (as the motion goldens).
  const still = { t: 0, moving: false, phase: 0, yaw: 0, headYaw: 0, shuffle: 0, view: 0 }
  const act = (id: string, t: number): Evaluated =>
    evaluate(s, gait, { ...still, action: { id, t, side: 'R' } })
  const ends: Record<string, Evaluated> = {
    reach: act('reach', gait.reach / 2),
    'look-out': act('look', 1),
    look: act('look', 4),
    flinch: act('flinch', 1),
  }
  const none: Evaluated = evaluate(s, gait, still)
  const fix = (x: number, digits: number) => Number(x.toFixed(digits))
  const units = (world: number[][], joint: number) =>
    [9, 10, 11].map((i) => fix((world[joint]?.[i] ?? 0) / k, 9))
  const degrees = (q: Q) => (eulerOf(q) as number[]).map((r) => fix((r * 180) / Math.PI, 6))
  /** The local turn that takes FigureBuilder's still pose of `joint` to its pose in `end`. */
  const turn = (end: Evaluated, joint: string) =>
    degrees(qmul(qconj(none.pose.rot[J[joint]] as Q), end.pose.rot[J[joint]] as Q))

  const golden = {
    source: 'mcthaydt/FigureBuilder a1f7246, src/render/figure/motion.ts evaluate()',
    body: 'wick',
    gait: 'bounce',
    ends: Object.fromEntries(
      Object.entries(ends).map(([id, end]) => [id, end.world.map((_, joint) => units(end.world, joint))]),
    ),
  }
  const text = `${JSON.stringify(golden)}\n`
  const clips = {
    turns: Object.fromEntries(
      ['look-out', 'look', 'flinch'].map((id) => [
        id,
        { neck: turn(ends[id] as Evaluated, 'neck'), head: turn(ends[id] as Evaluated, 'head') },
      ]),
    ),
    flinch: {
      pelvis: units((ends.flinch as Evaluated).world, J.pelvis),
      footR: units((ends.flinch as Evaluated).world, J['foot.R']),
      hand: [0.06, fix(s.chinY / k + 0.1, 9), 0.21],
    },
    reach: { handR: [fix((-s.genes.shoulders * 0.8) / k, 9), fix((s.shoulderY - 0.18 * k) / k, 9), 0.5] },
  }
  console.log(JSON.stringify(clips, null, 1))
  if (flag === '--check') {
    if (readFileSync(GOLDEN, 'utf8') !== text) {
      console.error('figurebuilder-actions.json differs from FigureBuilder')
      process.exit(1)
    }
  } else writeFileSync(GOLDEN, text)
} finally {
  rmSync(temp, { recursive: true, force: true })
}
