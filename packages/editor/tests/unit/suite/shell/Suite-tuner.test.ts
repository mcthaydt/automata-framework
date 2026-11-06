// @vitest-environment jsdom
import { screen, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { EDITOR_LIST_PATH } from '#src/features/suite/core/index.ts'
import { type SuiteHandle, startSuite } from '#src/features/suite/shell/boot.ts'
import { createSuite } from '#src/features/suite/shell/create-suite.ts'
import { samplePorts } from '#src/features/suite/shell/sample-ports.ts'
import { createTuner } from '#src/features/suite/tuner/tuner-suite-editor.ts'
import type { SuiteEditor } from '#src/shared/kit/ports/suite-editor.ts'
import { TUNING_FIXTURE, tunerFixtureFiles } from '#src/testing/suite/tuner-fixtures.ts'

// The Tuner in the suite shell (EDS.4a; editor suite spec §6.1): the editor list's `tuner` row opens it (Home no longer says
// "not installed"), a change asks for the change set's title once and then writes through the port, and Undo takes it back.

const LIST = `format = "af-editors/1"
[[file]]
glob = "content/tuning.toml"
editor = "tuner"
modes = ["edit", "ask"]
gates = []
checks = []
`

let started: SuiteHandle | undefined
afterEach(async () => {
  await started?.dispose()
  started = undefined
  document.body.innerHTML = ''
})

async function start() {
  const target = document.body.appendChild(document.createElement('div'))
  const ports = await samplePorts({ ...tunerFixtureFiles(), [EDITOR_LIST_PATH]: LIST })
  started = await startSuite(target, {
    window,
    document,
    ports,
    suite: createSuite({ editors: [createTuner() as SuiteEditor<unknown>] }),
  })
  return ports
}

describe('the Tuner in the suite', () => {
  it('opens from the editor list and fills the suite’s one shell', async () => {
    await start()
    await userEvent.click(await screen.findByRole('tab', { name: 'Tuner' }))
    expect(await screen.findByTestId('tuner-rows')).toBeInTheDocument()
    expect(screen.getAllByTestId('suite-shell')).toHaveLength(1)
    expect(screen.getByTestId('tuner-row-MAX_RUN')).toBeInTheDocument()
  })

  it('EDS-b: a change names its change set, writes one span, and Undo restores the text', async () => {
    const ports = await start()
    await userEvent.click(await screen.findByRole('tab', { name: 'Tuner' }))
    const row = await screen.findByTestId('tuner-row-DEBUG')
    await userEvent.click(within(row).getByRole('radio', { name: 'On' }))
    const dialog = await screen.findByRole('dialog', { name: 'Name this change' })
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Title' }), 'Debug on')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Start' }))
    const undo = await screen.findByRole('button', { name: 'Undo Set DEBUG to true' })
    expect((await ports.workspace.read('content/tuning.toml'))?.text).toBe(
      TUNING_FIXTURE.replace('DEBUG = false', 'DEBUG = true'),
    )
    await userEvent.click(undo)
    await screen.findByRole('button', { name: 'Undo' })
    expect((await ports.workspace.read('content/tuning.toml'))?.text).toBe(TUNING_FIXTURE)
  })
})
