// The four adventure scenes' converted puzzles (Node only: it reads the fixture files).
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'smol-toml'
import type { PuzzleDef } from '../entries/sim'

export const SCENES = ['prologue', 'clinic', 'clinic-dawn', 'bay'] as const

export const scenePuzzle = (scene: (typeof SCENES)[number]): PuzzleDef =>
  parse(
    readFileSync(join(import.meta.dirname, 'fixtures', `${scene}.puzzle.toml`), 'utf8'),
  ) as unknown as PuzzleDef

/** Every `{ call }` name the four scenes use, as a game registering them would declare. */
export const SCENE_CALLS: readonly string[] = [
  ...new Set(
    SCENES.flatMap((s) =>
      scenePuzzle(s).actions.flatMap((a) => a.then.flatMap((e) => ('call' in e ? [e.call] : []))),
    ),
  ),
].sort()
