// The four adventure scenes' converted cutscenes (Node only: it reads the fixture files).
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { parse } from 'smol-toml'
import type { CutsceneScript } from '../sim/index'

export const SCENES = ['prologue', 'clinic', 'clinic-dawn', 'bay'] as const
export type Scene = (typeof SCENES)[number]

export const scriptsOf = (scene: Scene): CutsceneScript[] =>
  (
    parse(
      readFileSync(join(import.meta.dirname, 'fixtures', `${scene}.cutscenes.toml`), 'utf8'),
    ) as unknown as {
      cutscenes: CutsceneScript[]
    }
  ).cutscenes

/** A scene's line text, from narrative's converted locale fixture. */
export const textOf = (scene: Scene): Record<string, string> =>
  parse(
    readFileSync(
      createRequire(import.meta.url).resolve(
        `@mcthaydt/automata-narrative/testing/fixtures/${scene}.locale.toml`,
      ),
      'utf8',
    ),
  ) as Record<string, string>
