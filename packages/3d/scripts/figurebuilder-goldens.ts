// Writes (or checks) the FigureBuilder goldens that build.test.ts compares build() against
// (src/tests/fixtures/__goldens__/figurebuilder-dress.json): FigureBuilder's own dress() on every outfit of
// src/testing/golden-outfits.ts, each part fingerprinted by src/testing/fingerprint.ts, with the outfit's anchors
// and its arms' clearance. M3.5b plan, decision 12.
//
// Run with Node 24 from the repository root, on a FigureBuilder checkout (mcthaydt/FigureBuilder at a1f7246):
//
//   node packages/3d/scripts/figurebuilder-goldens.ts /path/to/FigureBuilder           # writes the goldens
//   node packages/3d/scripts/figurebuilder-goldens.ts /path/to/FigureBuilder --check   # compares, exit 1 on a miss
//
// FigureBuilder's sources import without file extensions, which Node's type stripping cannot resolve, so the
// script copies its src/ (and the three AF testing files it needs) to a temp folder, adds `.ts` to relative
// imports and an import attribute to JSON ones, and loads them from there. Geometry never reads a colour, so the
// swatches are a proxy that answers any id; AF's kebab-case ids are turned back into FigureBuilder's camelCase.
//
// One change is made to FigureBuilder's code first (M3.5b decision 16): its sweep's tip closes exactly, as AF's
// does (src/hair/sweep.ts). The source's tip left a ring about 1e-10 m wide whenever a ratio rounded to just
// under 1, its normals' side then a coin toss on that offset, and which way it rounded differed between
// platforms; so the goldens taken without the change held one platform's toss.

import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const here = import.meta.dirname
const GOLDEN = join(here, '../tests/fixtures/__goldens__/figurebuilder-dress.json')
const [source, flag] = process.argv.slice(2)
if (!source) {
  console.error('usage: node figurebuilder-goldens.ts <FigureBuilder checkout> [--check]')
  process.exit(2)
}

/** Every .ts file under `dir`, recursively. */
const tsFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? tsFiles(path) : path.endsWith('.ts') ? [path] : []
  })
/** Relative imports made loadable by Node: `.ts` added, JSON imported with its attribute. */
const loadable = (path: string) =>
  writeFileSync(
    path,
    readFileSync(path, 'utf8')
      .replace(/(from '\.{1,2}\/[^']+?)(?<!\.json)'/g, "$1.ts'")
      .replace(/(from '\.{1,2}\/[^']+\.json')/g, "$1 with { type: 'json' }"),
  )

/** The source's tip, `q` from the tip's start, and AF's, `rem` tip lengths from the end (decision 16). */
const TIP_EDITS: readonly (readonly [string, string])[] = [
  [', q = (t - (1 - tipLen)) / tipLen;', ', rem = (1 - t) / tipLen;'],
  [
    "const end = q <= 0 ? 1 : tip === 'point' ? (1 - q) ** 1.3 : Math.sqrt(Math.max(0, 1 - q * q));",
    "const end = rem >= 1 ? 1 : tip === 'point' ? rem ** 1.3 : Math.sqrt(rem * (2 - rem));",
  ],
]
/** Applies TIP_EDITS to FigureBuilder's hair.ts, each exactly once (a different checkout fails loudly). */
function closeTips(path: string): void {
  let text = readFileSync(path, 'utf8')
  for (const [from, to] of TIP_EDITS) {
    if (text.split(from).length !== 2) throw new Error(`hair.ts: expected one \`${from}\``)
    text = text.replace(from, to)
  }
  writeFileSync(path, text)
}

const temp = mkdtempSync(join(tmpdir(), 'figurebuilder-goldens-'))
try {
  cpSync(join(source, 'src'), join(temp, 'fb'), { recursive: true })
  for (const file of ['golden-outfits.ts', 'fixture-sliders.ts', 'fingerprint.ts'])
    cpSync(join(here, '../src/testing', file), join(temp, 'af', file))
  for (const file of [...tsFiles(join(temp, 'fb')), ...tsFiles(join(temp, 'af'))]) loadable(file)
  closeTips(join(temp, 'fb/render/figure/hair.ts'))
  const load = (path: string) => import(pathToFileURL(join(temp, path)).href)
  const { dress, GROUP, SWATCHES } = await load('fb/render/figure/garments.ts')
  const { measure } = await load('fb/render/figure/genes.ts')
  const { skeleton } = await load('fb/render/figure/rig.ts')
  const { PPM } = await load('fb/render/figure/hair.ts')
  const { clearance } = await load('fb/render/figure/motion.ts')
  const { GOLDEN_OUTFITS } = await load('af/golden-outfits.ts')
  const { fingerprint } = await load('af/fingerprint.ts')

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
  const swatches = new Proxy(SWATCHES, { get: (t, name: string) => t[name] ?? t.black })
  const round = (x: unknown): unknown =>
    typeof x === 'number'
      ? Number(x.toPrecision(13))
      : Array.isArray(x)
        ? x.map(round)
        : x && typeof x === 'object'
          ? Object.fromEntries(Object.entries(x).map(([k, v]) => [k, round(v)]))
          : x
  const out: Record<string, { clearance: unknown; anchors: unknown[]; parts: unknown[] }> = {}
  for (const o of GOLDEN_OUTFITS) {
    const m = measure(o.sliders)
    const s = skeleton(m.genes)
    const look = dress(m, s, camel(o.skin), camel(o.garments), swatches, PPM)
    out[o.name] = {
      clearance: round(clearance(s, look.parts, { L: GROUP.armL, R: GROUP.armR }, [GROUP.head, GROUP.item])),
      anchors: (look.anchors ?? []).map((a: Record<string, unknown>) =>
        round({ kind: a.kind, side: a.side ?? null, bone: a.bone, at: a.at, open: a.open }),
      ),
      // The chain's nameplate is FigureBuilder's and is not taken (M3.5b decision 9): marked, so the test skips it.
      parts: look.parts.map((p: { material: string }) => ({
        ...(round(fingerprint(p)) as object),
        ...(p.material.endsWith('@plate') ? { cut: 'plate' } : {}),
      })),
    }
  }
  if (flag === '--check') {
    const want = JSON.parse(readFileSync(GOLDEN, 'utf8'))
    let misses = 0
    for (const [name, got] of Object.entries(out)) {
      const same = JSON.stringify(got) === JSON.stringify(want[name])
      if (!same) misses++
      console.log(`${name}: ${same ? 'same' : 'DIFFERS'}`)
    }
    process.exit(misses ? 1 : 0)
  }
  // One part per line, so a diff names the part that moved.
  const lines = ['{']
  Object.entries(out).forEach(([name, o], n, all) => {
    lines.push(
      `  ${JSON.stringify(name)}: {`,
      `    "clearance": ${JSON.stringify(o.clearance)},`,
      '    "anchors": [',
    )
    for (const [j, a] of o.anchors.entries())
      lines.push(`      ${JSON.stringify(a)}${j < o.anchors.length - 1 ? ',' : ''}`)
    lines.push('    ],', '    "parts": [')
    for (const [j, p] of o.parts.entries())
      lines.push(`      ${JSON.stringify(p)}${j < o.parts.length - 1 ? ',' : ''}`)
    lines.push('    ]', `  }${n < all.length - 1 ? ',' : ''}`)
  })
  lines.push('}')
  writeFileSync(GOLDEN, `${lines.join('\n')}\n`)
  console.log(`wrote ${Object.keys(out).length} outfits to ${GOLDEN}`)
} finally {
  rmSync(temp, { recursive: true, force: true })
}
