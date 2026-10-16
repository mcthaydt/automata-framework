// The defined corpus of `llms-full.txt` (DX spec §2.3: "generated from a defined corpus (docs and the API
// index)"). This list is the one place it is defined; the API reference is appended after these files.
// It holds what a game developer or agent needs to use AF: what AF is and its laws, the decisions in force, the
// shared contracts between packages, and the pinned versions. Planning and status documents stay out.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export const CORPUS: readonly string[] = [
  'docs/00-overview.md',
  'docs/adr/0001-ecs-choice.md',
  'docs/adr/0002-pixi-for-2d-and-3d.md',
  'docs/adr/0003-effect-outside-the-sim.md',
  'docs/adr/0004-ruken-first-host.md',
  'docs/adr/0005-publish-targets.md',
  'docs/superpowers/specs/2026-10-11-m1-shared-contracts-design.md',
  'docs/versions.md',
]

/** A corpus file is missing: the corpus is defined, so a file is never silently left out. */
export class CorpusFileMissingError extends Error {
  override readonly name = 'CorpusFileMissingError'
}

/** Each corpus file's path and text, in corpus order. */
export function readCorpus(root: string, corpus: readonly string[]): { path: string; text: string }[] {
  return corpus.map((path) => {
    const file = join(root, path)
    if (!existsSync(file))
      throw new CorpusFileMissingError(`llms-full.txt corpus file ${path} does not exist`)
    return { path, text: readFileSync(file, 'utf8').trimEnd() }
  })
}
