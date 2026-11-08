// The four converted scenes' systems files, read from the systems package's own fixtures (Node only).
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { openDocument } from '@automata/editor/kit/documents'
import type { PuzzleDef } from '@automata/puzzle/sim'
import type { SystemsDef } from '@automata/systems/sim'

export const SCENES = ['prologue', 'clinic', 'clinic-dawn', 'bay'] as const
export type Scene = (typeof SCENES)[number]

const need = createRequire(import.meta.url)

export function fixtureText(scene: Scene): string {
  return readFileSync(need.resolve(`@automata/systems/testing/fixtures/${scene}.systems.toml`), 'utf8')
}

export const fixture = (scene: Scene): SystemsDef =>
  openDocument(`${scene}.toml`, fixtureText(scene)).value() as SystemsDef

/** A converted scene's puzzle file, read from the puzzle package's own fixtures (Node only). */
export function puzzleText(scene: Scene): string {
  // The package exports no file path for its fixtures, so they are found beside its sim entry.
  const entries = need.resolve('@automata/puzzle/sim').replace(/entries\/sim\.ts$/, '')
  return readFileSync(`${entries}testing/fixtures/${scene}.puzzle.toml`, 'utf8')
}

export const puzzleFixture = (scene: Scene): PuzzleDef =>
  openDocument(`${scene}.toml`, puzzleText(scene)).value() as PuzzleDef
