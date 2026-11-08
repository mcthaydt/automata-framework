// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { EDITOR_LIST_PATH, loadEditorList, workspaceFile } from '#src/features/suite/core/index.ts'
import { type SuiteHandle, startSuite } from '#src/features/suite/shell/boot.ts'
import { createSuite } from '#src/features/suite/shell/create-suite.ts'
import { createMemoryPorts, type MemoryPorts } from '#src/shared/kit/ports/memory/memory-ports.ts'
import type { SuiteEditor } from '#src/shared/kit/ports/suite-editor.ts'
import { fixtureEditor } from '#src/testing/suite/fixture-editor.ts'

// Ship, the Review desk, Export and Import inside the suite, with the
// fixture editor over memory ports.
const TUNING = 'content/tuning.toml'
const START = 'MAX_MOVE_SPEED = 7\n'
const LIST = `format = "af-editors/1"
[[file]]
glob = "${TUNING}"
editor = "tuner"
modes = ["edit", "ask"]
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

async function memory(options: { changeSet?: false; gh?: boolean } = {}): Promise<MemoryPorts> {
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
    changeSet: options.changeSet === false ? false : { gh: options.gh ?? false },
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
  await screen.findByTestId('suite-home')
}

/** Opens the Tuner and raises the speed once, naming the change set. */
async function edit(): Promise<void> {
  await userEvent.click(await screen.findByRole('tab', { name: 'Tuner' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Raise speed' }))
  const dialog = await screen.findByRole('dialog', { name: 'Name this change' })
  await userEvent.type(within(dialog).getByRole('textbox', { name: 'Title' }), 'Faster')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Start' }))
  await waitFor(() => expect(screen.getByTestId('fixture-text').textContent).toBe('MAX_MOVE_SPEED = 8\n'))
}

const fileText = async (ports: MemoryPorts) => (await ports.ports.workspace.read(TUNING))?.text

describe('Suite: Ship, Review and the interchange', () => {
  it('without a change set port there is no Ship button', async () => {
    await start(await memory({ changeSet: false }))
    expect(screen.queryByRole('button', { name: 'Publish' })).toBeNull()
  })

  it('EDS-j: Ship drafts the description from the change, pushes and links the draft PR', async () => {
    await start(await memory({ gh: true }))
    await edit()
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }))
    const dialog = await screen.findByRole('dialog', { name: 'Publish your changes' })
    await waitFor(() =>
      expect((within(dialog).getByLabelText('Description') as HTMLTextAreaElement).value).toContain(TUNING),
    )
    await userEvent.click(within(dialog).getByRole('button', { name: 'Publish' }))
    expect(
      await within(dialog).findByRole('link', { name: 'Open the draft pull request' }),
    ).toBeInTheDocument()
  })

  it('the Review entry opens the desk with the change set, its diff and the reopened gate', async () => {
    await start(await memory())
    await edit()
    await userEvent.click(screen.getByRole('tab', { name: 'Review' }))
    const desk = await screen.findByRole('region', { name: 'Faster' })
    expect(within(desk).getByText('+ MAX_MOVE_SPEED = 8')).toBeInTheDocument()
    expect(within(desk).getByText('Feel: approved before this change; reopened')).toBeInTheDocument()
  })

  it('EDS-o: export from Home, change a value, import: the plan, Apply, and Undo takes it back', async () => {
    const ports = await memory()
    await ports.ports.changeSet?.begin('Speeds')
    await start(ports)
    await userEvent.click(screen.getByRole('button', { name: 'Export' }))
    const exporting = await screen.findByRole('dialog', { name: 'Export' })
    const out = within(exporting).getByLabelText('Exported document')
    await waitFor(() => expect((out as HTMLTextAreaElement).value).toContain('MAX_MOVE_SPEED = 7'))
    const document = (out as HTMLTextAreaElement).value.replace('MAX_MOVE_SPEED = 7', 'MAX_MOVE_SPEED = 9')
    await userEvent.click(within(exporting).getByRole('button', { name: 'Close' }))

    await userEvent.click(screen.getByRole('button', { name: 'Import' }))
    const importing = await screen.findByRole('dialog', { name: 'Import' })
    const field = within(importing).getByLabelText('Document to import')
    await userEvent.click(field)
    await userEvent.paste(document)
    await userEvent.click(within(importing).getByRole('button', { name: 'Plan' }))
    expect(await within(importing).findByText('+ MAX_MOVE_SPEED = 9')).toBeInTheDocument()
    expect(within(importing).getByText('Reopens g-feel')).toBeInTheDocument()
    await userEvent.click(within(importing).getByRole('button', { name: 'Apply' }))
    expect(await within(importing).findByRole('status')).toHaveTextContent('Undo takes it back')
    expect(await fileText(ports)).toBe('MAX_MOVE_SPEED = 9\n')
    await userEvent.click(within(importing).getByRole('button', { name: 'Close' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Undo Import' }))
    await waitFor(async () => expect(await fileText(ports)).toBe(START))
  })
})
