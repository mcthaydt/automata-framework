// The four original scenes' converted systems (Node only: it reads the fixture files).
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'smol-toml'
import type { SystemsDef } from '../shared/sim/systems.schema'

export const SCENES = ['prologue', 'clinic', 'clinic-dawn', 'bay'] as const

export const converted = (scene: (typeof SCENES)[number]): SystemsDef =>
  parse(
    readFileSync(join(import.meta.dirname, 'fixtures', `${scene}.systems.toml`), 'utf8'),
  ) as unknown as SystemsDef
