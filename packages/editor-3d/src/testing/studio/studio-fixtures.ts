// The sample game's figure content as the Studio's tests use it (EDS.9a): Wick, four poses, three clips and what they use,
// over memory ports whose editor list gives every file to the `studio` editor, writable.
import type { SuitePorts, UnlistedFile, WorkspaceFile } from '@automata/editor/kit/ports'
import { createMemoryPorts } from '@automata/editor/kit/ports/testing'

// The fixture files as Vite hands them over (the same in Node, jsdom and a browser), keyed by their path under `content/`.
const raw = import.meta.glob('../../app/suite/sample-3d/content/**/*.toml', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

export function studioFixtureFiles(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(raw).map(([path, text]) => [path.replace('../../app/suite/sample-3d/', ''), text]),
  )
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
