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

// Editing inside the suite: the title prompt, the pills and Undo, with the fixture editor over memory ports.
const TUNING = 'content/tuning.toml'
const START = 'MAX_MOVE_SPEED = 7\n'
const LIST = `format = "af-editors/1"
[[file]]
glob = "${TUNING}"
editor = "tuner"
modes = ["edit"]
gates = ["g-feel"]
checks = ["lint"]

[[gate]]
id = "g-feel"
name = "Feel"
records = "docs/gates.json"

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

async function memory(): Promise<MemoryPorts> {
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
        respond: () => ({ status: 'pass', findings: [], output: '' }),
      },
    ],
    gates: { 'g-feel': { name: 'Feel', decision: 'approved', url: 'https://example.com/g-feel' } },
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
  it('the first edit asks for a title, then writes, and the pills show the change set, checks and gates', async () => {
    const ports = await memory()
    await start(ports)
    // No change set yet: the pill has nothing to say, so it is not shown until the first edit opens one.
    expect(screen.queryByRole('button', { name: 'No change set' })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Raise speed' }))
    const dialog = await screen.findByRole('dialog', { name: 'Name this change' })
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Title' }), 'Faster')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Start' }))
    await waitFor(() => expect(text()).toBe('MAX_MOVE_SPEED = 8\n'))
    expect(await fileText(ports)).toBe('MAX_MOVE_SPEED = 8\n')
    expect(await screen.findByRole('button', { name: 'Faster' })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Checks pass' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '1 gate reopened' })).toBeInTheDocument()
  })

  it('cancelling the title writes nothing and keeps the old value', async () => {
    const ports = await memory()
    await start(ports)
    await userEvent.click(screen.getByRole('button', { name: 'Raise speed' }))
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(text()).toBe(START))
    expect(await fileText(ports)).toBe(START)
  })

  it('Undo and Redo in the top bar, and Mod+Z and Mod+Shift+Z, step the file and the document together', async () => {
    const ports = await memory()
    await ports.ports.changeSet?.begin('Faster')
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

  it('a reload over an open change set restores the pills from its journal, and says locks were cleared (EDS-z)', async () => {
    const ports = await memory()
    const changeSet = ports.ports.changeSet
    await changeSet?.begin('Faster')
    await changeSet?.record([TUNING], [{ path: TUNING, before: START, after: 'MAX_MOVE_SPEED = 8\n' }])
    await changeSet?.note([
      {
        check: 'lint',
        status: 'fail',
        findings: [{ path: TUNING, line: 1, severity: 'error', message: 'too fast' }],
      },
    ])
    await start(ports)
    expect(await screen.findByRole('button', { name: 'Faster' })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'lint failed' })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: '1 gate reopened' })).toBeInTheDocument()
    expect(await screen.findByText(/Locked values were cleared/)).toBeInTheDocument()
  })
})
