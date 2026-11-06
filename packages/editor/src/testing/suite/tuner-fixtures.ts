import { createMemoryPorts } from '../../features/suite/memory/memory-ports.ts'
import type { SuitePorts, WorkspaceFile } from '../../shared/kit/ports/suite-ports.ts'

// A game's tuning for the Tuner's tests: authored bounds, a code-owned row (its bounds in the compiler's meta), a unit in a
// comment, a toggle, a text row and a table the Tuner does not edit.

export const TUNING_FIXTURE: string = `# How the character moves.
# Celeste: 90 px/s.
MAX_RUN = { value = 384, min = 128, max = 768, step = 1 }
GRAVITY = 64 # px/s²
SCALE = 0.25
DEBUG = false
GREETING = "hello"
CURVE = [ 1, 2, 3 ]
`

export const TUNING_META_FIXTURE: string = JSON.stringify({
  GRAVITY: { type: 'int', value: 64, min: 16, max: 192, step: 1 },
})

export const tunerFixtureFiles = (): Record<string, string> => ({
  'content/tuning.toml': TUNING_FIXTURE,
  'content/generated/tuning-meta.json': TUNING_META_FIXTURE,
})

const classifyAs =
  (writable: boolean) =>
  (path: string): WorkspaceFile =>
    path === 'content/tuning.toml'
      ? writable
        ? { path, editor: 'tuner', gates: [], checks: ['content'], modes: ['edit', 'ask'], writable: true }
        : {
            path,
            editor: 'tuner',
            gates: [],
            checks: ['content'],
            modes: ['edit'],
            writable: false,
            why: 'The file is read only here.',
          }
      : {
          path,
          editor: undefined as never,
          gates: [],
          checks: [],
          modes: [],
          writable: false,
          why: 'It is generated.',
        }

export async function tunerFixturePorts(
  files: Readonly<Record<string, string>> = tunerFixtureFiles(),
  options: { readonly writable?: boolean } = {},
): Promise<SuitePorts> {
  const { ports } = await createMemoryPorts({
    files,
    classify: classifyAs(options.writable ?? true),
    generated: (path) => path.endsWith('tuning-meta.json'),
  })
  await ports.changeSet?.begin('Tuner fixture')
  return ports
}
