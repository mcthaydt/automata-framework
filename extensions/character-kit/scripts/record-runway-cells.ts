// Records the runway wardrobe's golden: the md5 of every runway model's painted cell (8 models × 4 directions, standing, D2), and
// of each on the five slider extremes the showcase's `fit-check` draws (front and three-quarter back), drawn by FigureBuilder's own
// showcase wardrobe, not by this kit. The kit's fit test paints the same models from its own port
// (`src/features/fashion`) and asserts every cell equal, so a garment that drifts from the showcase's, in fit, fabric or hair,
// fails with its model and direction. The showcase lives on FigureBuilder's `claude/runway-video` (`demo/runway`), in the
// archived repository and not in this one, so it is read from a clone of that repository that has the commit and run against the
// painter in this repository (`extensions/figures/src`): the cells are the showcase's code on the painter as it is here.
//
//   pnpm --filter @automata/character-kit goldens:runway -- <a FigureBuilder clone with commit cb4aa9f> [--out <dir>]
//
// Made only by this script, and re-made only when the painter moves (the commit that does it says why).
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { member, standing } from '../src/shared/figures/door.ts'
import { repointShowcase } from './showcase-imports.ts'

/** The showcase commit the golden is read from (FigureBuilder's `claude/runway-video`). */
export const SHOWCASE_COMMIT = 'cb4aa9f40cbaa2894ff7bf3d818db34ca2bde0d6'
/** The directions recorded for each model on its own body: front, two turns and a three-quarter back. */
const DIRECTIONS = [0, 1, 3, 6] as const
/** The slider extremes of the showcase's `fit-check.ts` (`demo/runway`), and the two directions it draws them in. */
const BODIES: Readonly<Record<string, Readonly<Record<string, number>>>> = {
  thin: { fat: 0, muscle: 0, frame: 0.5, height: 185, shoulders: 0, hips: 0 },
  heavy: { fat: 1.2, muscle: 0.5, frame: 0.5, hips: 1.1, shoulders: 1, neck: 1 },
  muscular: { fat: 0, muscle: 1, frame: 0, shoulders: 1, neck: 1 },
  curvy: { fat: 0.7, frame: 1, bust: 1, seat: 1, hips: 1 },
  short: { height: 150, legs: 0, fat: 0.5 },
}
const FIT_DIRECTIONS = [0, 5] as const
const GOLDENS = join(import.meta.dirname, '../tests/fixtures/goldens')
// The painter is a package of this repository: the showcase's imports are pointed at its own source, by file (showcase-imports.ts).
const BUILDER = join(import.meta.dirname, '../../figures')

const args = process.argv.slice(2).filter((a) => a !== '--')
const flag = args.indexOf('--out')
const out = flag >= 0 ? (args[flag + 1] ?? GOLDENS) : GOLDENS
const clone = args.find((a, i) => !a.startsWith('--') && (flag < 0 || i !== flag + 1))
if (clone === undefined)
  throw new Error('Usage: goldens:runway -- <a FigureBuilder clone with the showcase commit> [--out <dir>]')

const git = (cwd: string, ...a: string[]) => {
  const done = spawnSync('git', a, { cwd, encoding: 'utf8' })
  if (done.status !== 0) throw new Error(`git ${a.join(' ')} failed in ${cwd}: ${done.stderr}`)
  return done.stdout.trim()
}

// The showcase's three files, unchanged but for the paths to the builder's `src` (`../../src…`, mapped by showcase-imports.ts): they are made the
// painter's own, by file, so the showcase registers its fabrics, garments and hair on the very module instance the kit's door
// loads.
const work = mkdtempSync(join(tmpdir(), 'runway-showcase-'))
try {
  mkdirSync(join(work, 'demo/runway'), { recursive: true })
  // As ES modules, like the kit's door: loaded as CommonJS they would get their own copy of the builder and register on that.
  writeFileSync(join(work, 'package.json'), '{"type":"module"}\n')
  for (const file of ['characters', 'library', 'wardrobe']) {
    const source = spawnSync('git', ['show', `${SHOWCASE_COMMIT}:demo/runway/${file}.ts`], {
      cwd: resolve(clone),
      encoding: 'utf8',
    })
    if (source.status !== 0)
      throw new Error(`${clone} has no ${SHOWCASE_COMMIT}:demo/runway/${file}.ts: ${source.stderr}`)
    writeFileSync(join(work, `demo/runway/${file}.ts`), repointShowcase(source.stdout, BUILDER))
  }
  // Loading the showcase registers its fabrics, finishes, garments and swatches on the builder, as it does for its own renders.
  const { CAST } = (await import(pathToFileURL(join(work, 'demo/runway/characters.ts')).href)) as {
    CAST: readonly { def: Parameters<typeof member>[0] }[]
  }
  const md5 = (frame: Uint8ClampedArray) =>
    createHash('md5')
      .update(Buffer.from(frame.buffer, frame.byteOffset, frame.byteLength))
      .digest('hex')
  const cells: Record<string, Record<string, string>> = {}
  const fit: Record<string, Record<string, Record<string, string>>> = {}
  for (const { def } of CAST) {
    const cast = member(def, 2)
    const own: Record<string, string> = {}
    for (const d of DIRECTIONS) own[String(d)] = md5(standing(cast, d))
    cells[def.id] = own
    const bodies: Record<string, Record<string, string>> = {}
    for (const [name, sliders] of Object.entries(BODIES)) {
      const grown = member({ ...def, id: `${def.id}-fit`, sliders: { ...def.sliders, ...sliders } }, 2)
      const row: Record<string, string> = {}
      for (const d of FIT_DIRECTIONS) row[String(d)] = md5(standing(grown, d))
      bodies[name] = row
    }
    fit[def.id] = bodies
  }
  mkdirSync(out, { recursive: true })
  const golden = {
    note: "md5 of each runway model's painted cell (standing, D2) drawn by the showcase's own wardrobe. Made by scripts/record-runway-cells.ts; never by hand.",
    showcase: {
      branch: 'claude/runway-video',
      commit: SHOWCASE_COMMIT,
      files: 'demo/runway/{characters,library,wardrobe}.ts',
    },
    figureBuilder: git(BUILDER, 'rev-parse', 'HEAD'),
    density: 2,
    directions: DIRECTIONS,
    cells,
    bodies: BODIES,
    fitDirections: FIT_DIRECTIONS,
    fit,
  }
  writeFileSync(join(out, 'runway-cells.json'), `${JSON.stringify(golden, null, 2)}\n`)
  // The repo's formatter owns JSON, so the file is left as a commit would have it.
  spawnSync('pnpm', ['exec', 'biome', 'format', '--write', join(out, 'runway-cells.json')], {
    cwd: join(import.meta.dirname, '../../..'),
    stdio: 'inherit',
  })
  console.log(
    `wrote ${join(out, 'runway-cells.json')}: ${Object.keys(cells).length} models × ${DIRECTIONS.length} directions`,
  )
} finally {
  rmSync(work, { recursive: true, force: true })
}
