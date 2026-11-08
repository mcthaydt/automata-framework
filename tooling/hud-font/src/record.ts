import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

/** Where the generated modules and their record live, inside the browser package. */
export const FONTS_DIR: string = resolve(
  import.meta.dirname,
  '../../../packages/automata/src/features/hud-text/fonts',
)
export const RECORD_FILE: string = 'fonts.record.json'

export interface FontsRecord {
  source: { package: string; file: string; sha256: string; licence: string }
  baker: string
  pages: Record<string, { glyphs: number; atlasBytes: number; atlasSize: string }>
  files: Record<string, { sha256: string; bytes: number }>
}

export const sha256 = (data: Buffer | string): string => createHash('sha256').update(data).digest('hex')

/**
 * Problems with the committed outputs, empty when fine. It reads files only: the baker ships a native binary per
 * platform, so a bake on another machine may differ, and `pnpm check` must never bake again.
 */
export const verifyRecord = (dir: string): string[] => {
  const record = JSON.parse(readFileSync(join(dir, RECORD_FILE), 'utf8')) as FontsRecord
  const problems: string[] = []
  for (const [name, entry] of Object.entries(record.files)) {
    let digest: string | undefined
    try {
      digest = sha256(readFileSync(join(dir, name)))
    } catch {
      digest = undefined
    }
    if (digest !== entry.sha256) problems.push(`${name}: sha256 does not match ${RECORD_FILE}`)
  }
  return problems
}
