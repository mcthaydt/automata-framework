// What a golden test says when painted cells miss their md5: all of the misses, the machine they were made on, and the cells
// themselves. A cell's md5 is all the golden holds (and it must not move to explain a miss), so there is no expected cell to
// diff against in the log; the actual one is printed instead, gzipped and in base64, to be diffed offline against a cell made
// on another platform (`decodeDump`). It exists for the question "does this painter give the same texels on arm64 and x64?".
import { createHash } from 'node:crypto'
import { gunzipSync, gzipSync } from 'node:zlib'

export interface CellMiss {
  readonly label: string
  /** The golden's md5, or undefined when the golden has no entry. */
  readonly expected: string | undefined
  /** The painted cell's bytes (RGBA). */
  readonly cell: ArrayBufferView
}

export interface Machine {
  readonly arch: string
  readonly node: string
  readonly platform: string
}

export interface MissReport {
  readonly text: string
  /** One entry per dumped miss: its header line, then the gzipped cell in base64, in short lines. */
  readonly dumps: readonly (readonly string[])[]
}

/** How many misses are dumped; a platform that differs everywhere would fill a CI log with cells. */
const MAX_DUMPS = 4
const LINE = 200

const bytesOf = (cell: ArrayBufferView): Buffer => Buffer.from(cell.buffer, cell.byteOffset, cell.byteLength)

export const cellMd5 = (cell: ArrayBufferView): string =>
  createHash('md5').update(bytesOf(cell)).digest('hex')

/** The machine this runs on. */
export const thisMachine = (): Machine => ({
  arch: process.arch,
  node: process.version,
  platform: process.platform,
})

/** The cell a dump holds, read back from its lines (the header line first). */
export const decodeDump = (lines: readonly string[]): Uint8Array =>
  new Uint8Array(gunzipSync(Buffer.from(lines.slice(1).join(''), 'base64')))

/** The report for these misses, or undefined when there are none. */
export function missReport(misses: readonly CellMiss[], machine: Machine): MissReport | undefined {
  if (misses.length === 0) return undefined
  const rows = misses.map(({ label, expected, cell }) => {
    const bytes = bytesOf(cell)
    let opaque = 0
    for (let i = 3; i < bytes.length; i += 4) if ((bytes[i] ?? 0) > 0) opaque++
    return `  ${label}: expected ${expected ?? 'nothing'}, got ${cellMd5(cell)} (${bytes.length} bytes, ${opaque} opaque texels)`
  })
  const dumped = misses.slice(0, MAX_DUMPS)
  const dumps = dumped.map(({ label, cell }) => {
    const base64 = gzipSync(bytesOf(cell)).toString('base64')
    const lines = [`cell-dump ${label} bytes=${cell.byteLength} md5=${cellMd5(cell)}`]
    for (let i = 0; i < base64.length; i += LINE) lines.push(base64.slice(i, i + LINE))
    return lines
  })
  const only = misses.length > dumped.length ? `; only the first ${dumped.length} are dumped` : ''
  const text = [
    `${misses.length} cells miss their golden (${machine.platform} ${machine.arch}, node ${machine.node}${only}):`,
    ...rows,
  ].join('\n')
  return { text, dumps }
}

/** Throws the report (and logs the dumps) when there are misses. Called after every case of a test has been tried. */
export function failOnMisses(misses: readonly CellMiss[]): void {
  const report = missReport(misses, thisMachine())
  if (report === undefined) return
  for (const dump of report.dumps) console.info(dump.join('\n'))
  throw new Error(report.text)
}
