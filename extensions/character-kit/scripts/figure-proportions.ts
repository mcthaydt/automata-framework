// The proportions table of the painted cast, read from the pictures (`src/testing/proportions.ts`): Ada and the night nurse as they are
// now, the figure builder's base pair, and the old game's own figures (the target) cropped from its review sheets. Nothing is typed.
//
//   pnpm --filter @automata/character-kit proportions <out-file> --old <old-game-checkout> [<label> ...]
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  decodePng,
  type PaintedCell,
  type Proportions,
  proportions,
  proportionsOfCells,
} from '../src/entries/testing.ts'
import { BASE, type CharacterDef } from '../src/shared/figures/door.ts'
import { oldCell, SUBJECTS, type Subject } from './figure-sheet.ts'

const f2 = (n: number | undefined) => (n === undefined || !Number.isFinite(n) ? '-' : n.toFixed(2))
const pc = (n: number | undefined) => (n === undefined ? '-' : `${Math.round(n * 100)}%`)

/** One column of the table: a name and the numbers of one figure. */
export interface Column {
  readonly name: string
  readonly p: Proportions
}

const ROWS: readonly [string, (p: Proportions) => string][] = [
  ['height (rows)', (p) => String(p.height)],
  ['head rows, hair on', (p) => String(p.headRowsWithHair)],
  ['head rows, skull', (p) => (p.rig === undefined ? '-' : String(p.headRows))],
  ['heads tall, hair on', (p) => f2(p.headsWithHair)],
  ['heads tall, skull', (p) => (p.rig === undefined ? '-' : f2(p.heads))],
  ['neck rows (skin)', (p) => String(p.neckRows)],
  ['trunk rows', (p) => String(p.trunkRows)],
  ['leg rows', (p) => String(p.legRows)],
  ['head width', (p) => String(p.headWidth)],
  ['shoulder / waist / hip', (p) => `${p.shoulder} / ${p.waist} / ${p.hip}`],
  ['shoulder in head widths', (p) => f2(p.shoulderHeads)],
  ['hip / shoulder', (p) => f2(p.hip / p.shoulder)],
  ['legs part at (picture)', (p) => pc(p.legsPart)],
  ['hip joint (rig)', (p) => pc(p.rig?.hipJoint)],
  ['knee (rig)', (p) => pc(p.rig?.knee)],
  ['elbow (rig)', (p) => pc(p.rig?.elbow)],
  ['wrist (rig)', (p) => pc(p.rig?.wrist)],
  ['fingertip (rig)', (p) => pc(p.rig?.fingertip)],
  ['foot length (texels)', (p) => String(p.footLength ?? '-')],
  ['foot length, in heads', (p) => f2(p.footHeads)],
]

export function table(title: string, columns: readonly Column[]): string {
  const w0 = Math.max(...ROWS.map(([n]) => n.length)) + 2
  const cell = (s: string) => s.padEnd(Math.max(18, ...columns.map((c) => c.name.length + 2)))
  const lines = [title, `${''.padEnd(w0)}${columns.map((c) => cell(c.name)).join('')}`]
  for (const [name, read] of ROWS)
    lines.push(`${name.padEnd(w0)}${columns.map((c) => cell(read(c.p))).join('')}`)
  return lines.join('\n')
}

/** The old game's cell `row` of its review sheet, front view, as a painted cell. */
function oldFront(root: string, subject: Subject, row: number): PaintedCell {
  const sheet = decodePng(readFileSync(join(root, subject.old.file)))
  const c = oldCell(sheet, subject.old.cell, row, 0)
  return { painted: c.data, size: [c.w, c.h] }
}

/** The old side view (cell 2 of the row: the figure's left) for the feet. */
function oldSide(root: string, subject: Subject, row: number): PaintedCell {
  const sheet = decodePng(readFileSync(join(root, subject.old.file)))
  const c = oldCell(sheet, subject.old.cell, row, 2)
  return { painted: c.data, size: [c.w, c.h] }
}

export function oldColumns(root: string, subject: Subject): Column[] {
  const read = (name: string, row: number): Column => ({
    name,
    p: proportionsOfCells({
      def: subject.def,
      front: oldFront(root, subject, row),
      side: oldSide(root, subject, row),
    }),
  })
  const columns = [read('old procedural', subject.old.procedural)]
  if (subject.old.atlas !== undefined) columns.push(read('old atlas', subject.old.atlas))
  return columns
}

export function proportionsReport(root: string | undefined, defs?: Record<string, CharacterDef>): string {
  const out: string[] = []
  for (const s of SUBJECTS) {
    const def = defs?.[s.id] ?? s.def
    const cols: Column[] = [
      { name: 'ours d1', p: proportions(def, 1) },
      { name: 'ours d2', p: proportions(def, 2) },
    ]
    if (root !== undefined) cols.push(...oldColumns(root, s))
    out.push(table(`${s.def.name}`, cols), '')
  }
  if (defs === undefined)
    out.push(
      table(
        'The builder’s base pair (a bare reference, not the target)',
        BASE.flatMap((b, i) =>
          [1, 2].map((d) => ({
            name: `base ${i === 0 ? 'm' : 'f'} d${d}`,
            p: proportions((b as { def: CharacterDef }).def, d as 1 | 2),
          })),
        ),
      ),
    )
  return out.join('\n')
}

if (process.argv[1]?.endsWith('figure-proportions.ts')) {
  const args = process.argv.slice(2)
  const oldAt = args.indexOf('--old')
  const outFile = args[0]
  if (outFile === undefined) throw new Error('usage: figure-proportions <out-file> [--old <dir>]')
  const text = proportionsReport(oldAt < 0 ? undefined : args[oldAt + 1])
  writeFileSync(outFile, `${text}\n`)
  console.log(text)
}
