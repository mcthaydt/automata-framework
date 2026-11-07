// The four adventure scenes' converted narrative content (Node only: it reads the fixture files).
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'smol-toml'

export const SCENES = ['prologue', 'clinic', 'clinic-dawn', 'bay'] as const

export const fixture = (name: string): Record<string, unknown> =>
  parse(readFileSync(join(import.meta.dirname, 'fixtures', name), 'utf8')) as Record<string, unknown>
