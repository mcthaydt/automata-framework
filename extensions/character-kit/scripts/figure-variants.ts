// A round's variants of one character, side by side: the same character in two or three versions (A, B, C) of its data, drawn at
// the size it is played at (density 1, each texel 4 pixels) in four standing views and four walk poses, under the old game's own
// figure, and again at density 2 for the front, three-quarter and back views. The lists are `figure-looks.ts`'s (`LOOKS`).
//
//   pnpm --filter @automata/character-kit variants <out-dir> <name> <id: ada|nurse> <look> [--old <old-game-checkout>]
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { decodePng, encodePng, paintedStand, paintedWalk, silhouette } from '../src/entries/testing.ts'
import { LOOKS } from './figure-looks.ts'
import { asRaster, at, measure, NAMES, oldCell, panel, row, SUBJECTS, stack } from './figure-sheet.ts'

const STAND = [0, 1, 2, 4] as const
/** Four poses spread over a walk of any length (a gait may have 6 or 8). */
const walkOf = (n: number): number[] => [0, 1, 2, 3].map((i) => Math.floor((i * n) / 4))

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const flag = (name: string) => {
    const at = args.indexOf(name)
    return at < 0 ? undefined : args[at + 1]
  }
  const [out, name, id, look] = args
  const oldRoot = flag('--old')
  if (out === undefined || name === undefined || id === undefined || look === undefined)
    throw new Error(
      `usage: figure-variants <out-dir> <name> <ada|nurse> <look: ${Object.keys(LOOKS).join(' | ')}> [--old <dir>]`,
    )
  const subject = SUBJECTS.find((s) => s.id === id)
  if (subject === undefined) throw new Error(`no subject ${id}`)
  const variants = LOOKS[look]
  if (variants === undefined) throw new Error(`no look ${look}: ${Object.keys(LOOKS).join(', ')}`)

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
  const diffs = variants.flatMap((v) => {
    const other = variants.find((o) => o.label === v.against)
    if (other === undefined) return []
    const [a, b] = [paintedStand(v.def, 2), paintedStand(other.def, 2)]
    const differing = a.map((cell, view) => {
      let count = 0
      const painted = at(b, view).painted
      for (let i = 0; i < cell.painted.length; i += 4)
        if (cell.painted.slice(i, i + 4).join() !== painted.slice(i, i + 4).join()) count++
      return count
    })
    const total = differing.reduce((x, y) => x + y, 0)
    return [
      `${v.label} against ${other.label}: texels that differ in the eight views at density 2: ${differing.join(', ')} (${total} in all)`,
    ]
  })
  if (diffs.length > 0) writeFileSync(join(out, `${name}-diff.txt`), `${diffs.join('\n')}\n`)
  console.log(
    variants.map((v) => `${v.label}: ${measure(silhouette(at(paintedStand(v.def, 1), 0)))}`).join('\n'),
  )
}

if (process.argv[1]?.endsWith('figure-variants.ts')) await main()
