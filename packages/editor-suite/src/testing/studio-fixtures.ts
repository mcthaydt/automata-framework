// The recorded fixture game of the Studio's tests (EDS.9a): Wick, four poses, three clips and what they use, copied from
// base-3d's content, over memory ports whose editor list gives every file to the `studio` editor, writable.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { SuitePorts, UnlistedFile, WorkspaceFile } from '@mcthaydt/automata-editor-kit/ports'
import { createMemoryPorts } from '@mcthaydt/automata-editor-kit/ports/testing'

const ROOT = new URL('./fixtures/studio/', import.meta.url).pathname

export function studioFixtureFiles(): Record<string, string> {
  const found: Record<string, string> = {}
  const walk = (dir: string): void => {
    for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
      const path = `${dir}/${entry.name}`
      if (entry.isDirectory()) walk(path)
      else found[path] = readFileSync(join(ROOT, path), 'utf8')
    }
  }
  walk('content')
  return found
}

const classify = (path: string): WorkspaceFile | UnlistedFile => ({
  path,
  editor: 'studio',
  gates: [],
  checks: ['content'],
  modes: ['edit'],
  writable: true,
})

export async function studioFixturePorts(
  files: Readonly<Record<string, string>> = studioFixtureFiles(),
): Promise<SuitePorts> {
  const { ports } = await createMemoryPorts({ files, classify })
  // The suite opens a change set before the first write; a file it creates is recorded there, which is what lets Undo remove it.
  await ports.changeSet?.begin('Studio fixture')
  return ports
}
