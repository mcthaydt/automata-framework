// A round's variants of one character, side by side: the same character in two or three versions (A, B, C) of its data, drawn at
// the size it is played at (density 1, each texel 4 pixels) in four standing views and four walk poses, under the old game's own
// figure, and again at density 2 for the front, three-quarter and back views. `--module` names a file exporting a list of
// `{ label, note, def }` (`--export` names the list, `variants` by default); each round's file lives with its sheets.
//
//   pnpm --filter @automata/character-kit variants <out-dir> <name> <id: ada|nurse> --module <file> [--export <name>] [--old <old-game-checkout>]
import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { CharacterDef } from '../src/entries/index.ts'
import { decodePng, encodePng, paintedStand, paintedWalk, silhouette } from '../src/entries/testing.ts'
import { asRaster, at, measure, NAMES, oldCell, panel, row, SUBJECTS, stack } from './figure-sheet.ts'

export interface Variant {
  readonly label: string
  readonly note: string
  readonly def: CharacterDef
}

const STAND = [0, 1, 2, 4] as const
/** Four poses spread over a walk of any length (a gait may have 6 or 8). */
const walkOf = (n: number): number[] => [0, 1, 2, 3].map((i) => Math.floor((i * n) / 4))

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const flag = (name: string) => {
    const at = args.indexOf(name)
    return at < 0 ? undefined : args[at + 1]
  }
  const [out, name, id] = args
  const file = flag('--module')
  const oldRoot = flag('--old')
  if (out === undefined || name === undefined || id === undefined || file === undefined)
    throw new Error('usage: figure-variants <out-dir> <name> <ada|nurse> --module <file> [--old <dir>]')
  const subject = SUBJECTS.find((s) => s.id === id)
  if (subject === undefined) throw new Error(`no subject ${id}`)
  const variants = ((await import(resolve(file))) as Record<string, Variant[]>)[
    flag('--export') ?? 'variants'
  ]
  if (variants === undefined) throw new Error(`${file} exports no ${flag('--export') ?? 'variants'}`)

  const rows = []
  for (const v of variants) {
    const stand = paintedStand(v.def, 1)
    const walk = paintedWalk(v.def, 1)
    rows.push(
      row(`${v.label} - ${v.note} - ${measure(silhouette(at(stand, 0)))}`, [
        ...STAND.map((d) => panel(asRaster(at(stand, d)), 4, NAMES[d] ?? '', 64)),
        ...walkOf(walk.length).map((i) =>
          panel(asRaster(at(walk, i)), 4, `WALK ${i + 1} OF ${walk.length}`, 64),
        ),
      ]),
    )
  }
  if (oldRoot !== undefined) {
    const sheet = decodePng(readFileSync(join(oldRoot, subject.old.file)))
    rows.unshift(
      row(
        'OLD GAME PROCEDURAL, SAME SCALE',
        STAND.map((d) =>
          panel(oldCell(sheet, subject.old.cell, subject.old.procedural, d), 4, NAMES[d] ?? '', 64),
        ),
      ),
    )
    const atlas = subject.old.atlas
    if (atlas !== undefined)
      rows.splice(
        1,
        0,
        row(
          'OLD GAME HAND-PAINTED ATLAS, SAME SCALE',
          STAND.map((d) => panel(oldCell(sheet, subject.old.cell, atlas, d), 4, NAMES[d] ?? '', 64)),
        ),
      )
  }
  writeFileSync(join(out, `${name}-play.png`), encodePng(stack(rows)))

  const detail = variants.map((v) => {
    const stand = paintedStand(v.def, 2)
    return row(
      `${v.label} - DENSITY 2, X2`,
      [0, 1, 2, 4, 6].map((d) => panel(asRaster(at(stand, d)), 2, NAMES[d] ?? '', 128)),
    )
  })
  writeFileSync(join(out, `${name}-detail.png`), encodePng(stack(detail)))
  console.log(
    variants.map((v) => `${v.label}: ${measure(silhouette(at(paintedStand(v.def, 1), 0)))}`).join('\n'),
  )
}

if (process.argv[1]?.endsWith('figure-variants.ts')) await main()
