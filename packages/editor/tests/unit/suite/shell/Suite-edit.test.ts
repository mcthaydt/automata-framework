// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { EDITOR_LIST_PATH, loadEditorList, workspaceFile } from '#src/features/suite/core/index.ts'
import { createMemoryPorts, type MemoryPorts } from '#src/features/suite/memory/memory-ports.ts'
import { type SuiteHandle, startSuite } from '#src/features/suite/shell/boot.ts'
import { createSuite } from '#src/features/suite/shell/create-suite.ts'
import type { SuiteEditor } from '#src/shared/kit/ports/suite-editor.ts'
import { fixtureEditor } from '#src/testing/suite/fixture-editor.ts'

// Editing inside the suite: the checks pill and Undo, with the fixture editor over memory ports.
const TUNING = 'content/tuning.toml'
const START = 'MAX_MOVE_SPEED = 7\n'
const LIST = `format = "af-editors/1"
[[file]]
glob = "${TUNING}"
editor = "tuner"
modes = ["edit"]
gates = []
checks = ["lint"]

[[check]]
id = "lint"
when = "after"
run = ["lint"]
`

let started: SuiteHandle | undefined
afterEach(async () => {
  await started?.dispose()
  started = undefined
  document.body.innerHTML = ''
})

async function memory(lint: 'pass' | 'fail' = 'pass'): Promise<MemoryPorts> {
  const load = loadEditorList(LIST)
  if (!load.ok) throw new Error(JSON.stringify(load.problems))
  return createMemoryPorts({
    files: { [EDITOR_LIST_PATH]: LIST, [TUNING]: START },
    classify: (path) => workspaceFile(load.list, path),
    checks: [
      {
        id: 'lint',
        when: 'after',
        run: ['lint'],
        joins: [],
        measure: false,
        respond: () =>
          lint === 'pass'
            ? { status: 'pass', findings: [], output: '' }
            : {
                status: 'fail',
                findings: [{ path: TUNING, line: 1, severity: 'error', message: 'too fast' }],
                output: '',
              },
      },
    ],
  })
}

async function start(ports: MemoryPorts) {
  const target = document.body.appendChild(document.createElement('div'))
  started = await startSuite(target, {
    window,
    document,
    ports: ports.ports,
    suite: createSuite({ editors: [fixtureEditor as SuiteEditor<unknown>] }),
  })
  await userEvent.click(await screen.findByRole('tab', { name: 'Tuner' }))
  await screen.findByTestId('fixture-text')
}

const text = () => screen.getByTestId('fixture-text').textContent
const fileText = async (ports: MemoryPorts) => (await ports.ports.workspace.read(TUNING))?.text

describe('Suite editing', () => {
  it('an edit writes the file, and the checks pill shows the check that ran', async () => {
    const ports = await memory()
    await start(ports)
    // Nothing has run yet: the pill has nothing to say, so it is not shown.
    expect(screen.queryByRole('button', { name: 'No checks run' })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Raise speed' }))
    await waitFor(() => expect(text()).toBe('MAX_MOVE_SPEED = 8\n'))
    expect(await fileText(ports)).toBe('MAX_MOVE_SPEED = 8\n')
    expect(await screen.findByRole('button', { name: 'Checks pass' })).toBeInTheDocument()
  })

  it('a check that fails is named on the pill', async () => {
    const ports = await memory('fail')
    await start(ports)
    await userEvent.click(screen.getByRole('button', { name: 'Raise speed' }))
    expect(await screen.findByRole('button', { name: 'lint failed' })).toBeInTheDocument()
  })

  it('Undo and Redo in the top bar, and Mod+Z and Mod+Shift+Z, step the file and the document together', async () => {
    const ports = await memory()
    await start(ports)
    await userEvent.click(screen.getByRole('button', { name: 'Raise speed' }))
    await waitFor(() => expect(text()).toBe('MAX_MOVE_SPEED = 8\n'))
    await userEvent.click(await screen.findByRole('button', { name: 'Undo Raise speed' }))
    await waitFor(() => expect(text()).toBe(START))
    expect(await fileText(ports)).toBe(START)
    await userEvent.keyboard('{Control>}{Shift>}z{/Shift}{/Control}')
    await waitFor(() => expect(text()).toBe('MAX_MOVE_SPEED = 8\n'))
    expect(await fileText(ports)).toBe('MAX_MOVE_SPEED = 8\n')
    await userEvent.keyboard('{Control>}z{/Control}')
    await waitFor(() => expect(text()).toBe(START))
    expect(screen.getByRole('button', { name: 'Redo Raise speed' })).toBeEnabled()
  })
})
