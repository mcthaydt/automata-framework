// The four converted scenes' systems files, read from the systems package's own fixtures (Node only).
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { openDocument } from '@automata/editor/kit/documents'
import type { SystemsDef } from '@automata/systems/sim'

export const SCENES = ['prologue', 'clinic', 'clinic-dawn', 'bay'] as const
export type Scene = (typeof SCENES)[number]

const need = createRequire(import.meta.url)

export function fixtureText(scene: Scene): string {
  return readFileSync(need.resolve(`@automata/systems/testing/fixtures/${scene}.systems.toml`), 'utf8')
}

export const fixture = (scene: Scene): SystemsDef =>
  openDocument(`${scene}.toml`, fixtureText(scene)).value() as SystemsDef
