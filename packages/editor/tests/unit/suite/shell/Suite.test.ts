// @vitest-environment jsdom
import { screen, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { createRawSnippet } from 'svelte'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EDITOR_LIST_PATH } from '#src/features/suite/core/index.ts'
import { type SuiteHandle, startSuite } from '#src/features/suite/shell/boot.ts'
import { createSuite } from '#src/features/suite/shell/create-suite.ts'
import type { SuiteEditor } from '#src/shared/kit/ports/suite-editor.ts'
import { FLOORFIFTY_SAMPLE, samplePorts } from '#src/testing/suite/sample-ports.ts'

// The suite started the way `main.ts` starts it, over memory ports (editor suite spec §5 flows 1 and 2, §9, §11).
let started: SuiteHandle | undefined
afterEach(async () => {
  await started?.dispose()
  started = undefined
  document.body.innerHTML = ''
})

async function start(files: Record<string, string>, editors: SuiteEditor<unknown>[] = []) {
  const target = document.body.appendChild(document.createElement('div'))
  started = await startSuite(target, {
    window,
    document,
    ports: await samplePorts(files),
    suite: createSuite({ editors }),
  })
}

const feelList = `format = "af-editors/1"
[[file]]
glob = "content/feel.toml"
editor = "feel"
modes = ["edit"]
gates = []
checks = []
`

describe('Suite Home', () => {
  it("shows a card for each editor the game's list names, with the files each edits", async () => {
    await start(FLOORFIFTY_SAMPLE)
    const tuner = await screen.findByRole('region', { name: 'Tuner' })
    expect(within(tuner).getByRole('button', { name: /content\/tuning\.toml/ })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Levels 2D' })).toBeInTheDocument()
    expect(screen.getAllByRole('tab')).toHaveLength(9)
  })

  it('EDS-l: marks Feel not installed with its package, and its file opens read only', async () => {
    await start({ [EDITOR_LIST_PATH]: feelList, 'content/feel.toml': '[limits]\nshake = 0.4\n' })
    const feel = await screen.findByRole('region', { name: 'Feel' })
    expect(within(feel).getByText('Not in this build')).toBeInTheDocument()
    expect(within(feel).getByText(/comes with the Plus editors \(editor-plus\)/)).toBeInTheDocument()
    await userEvent.click(within(feel).getByRole('button', { name: /content\/feel\.toml/ }))
    const source = await screen.findByRole('region', { name: 'content/feel.toml' })
    expect(within(source).getByText('Read only')).toBeInTheDocument()
    expect(within(source).getByText(/shake = 0\.4/)).toBeInTheDocument()
    expect(within(source).queryByRole('textbox')).toBeNull()
    await userEvent.click(within(source).getByRole('button', { name: 'Back to Home' }))
    expect(await screen.findByRole('region', { name: 'Feel' })).toBeInTheDocument()
  })

  it('EDS-m: a row without gates shows the problem with its key path, every editor read only, and no cards', async () => {
    await start({
      [EDITOR_LIST_PATH]:
        'format = "af-editors/1"\n[[file]]\nglob = "content/tuning.toml"\neditor = "tuner"\nmodes = ["edit"]\nchecks = []\n',
    })
    const problem = await screen.findByRole('alert')
    expect(within(problem).getByText(/Every editor is read only/)).toBeInTheDocument()
    expect(within(problem).getByText('file[0].gates')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Tuner' })).toBeNull()
  })

  it('says when there is no editor list, and names the format of a newer one', async () => {
    await start({})
    expect(
      within(await screen.findByRole('alert')).getByText(/has no content\/editors\.toml/),
    ).toBeInTheDocument()
    await started?.dispose()
    document.body.innerHTML = ''
    await start({ [EDITOR_LIST_PATH]: 'format = "af-editors/2"\n' })
    expect(within(await screen.findByRole('alert')).getByText('af-editors/2')).toBeInTheDocument()
  })
})

describe('Suite entries', () => {
  it("an entry's page lists its cards; Review opens the desk; Home brings the cards back", async () => {
    await start(FLOORFIFTY_SAMPLE)
    await userEvent.click(await screen.findByRole('tab', { name: 'Levels' }))
    expect(screen.getByRole('tab', { name: 'Levels' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('region', { name: 'Levels 2D' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Tuner' })).toBeNull()
    await userEvent.click(screen.getByRole('tab', { name: 'Review' }))
    expect(await screen.findByTestId('review-desk')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Home' }))
    expect(screen.getByRole('region', { name: 'Tuner' })).toBeInTheDocument()
  })

  it('an entry the list names no files for says so', async () => {
    await start(FLOORFIFTY_SAMPLE)
    await userEvent.click(await screen.findByRole('tab', { name: 'Studio' }))
    expect(screen.getByText(/names no files for Studio/)).toBeInTheDocument()
  })

  it('opens an installed editor once with its files, fills the regions, and keeps its session across a switch', async () => {
    const open = vi.fn(async () => ({ name: 'tuning session' }))
    const text = (label: string) =>
      createRawSnippet((session: () => { name: string }) => ({
        render: () => `<p>${label}: ${session().name}</p>`,
      }))
    const tuner = {
      id: 'tuner',
      label: 'Tuner',
      icon: 'sliders',
      hue: 'color/ed/tuner',
      open,
      regions: { panel: text('groups'), canvas: text('sliders'), inspector: text('details') },
    } as unknown as SuiteEditor<unknown>
    await start(FLOORFIFTY_SAMPLE, [tuner])
    await userEvent.click(await screen.findByRole('tab', { name: 'Tuner' }))
    expect(await screen.findByText('sliders: tuning session')).toBeInTheDocument()
    expect(screen.getByText('groups: tuning session')).toBeInTheDocument()
    expect(open).toHaveBeenCalledTimes(1)
    expect((open.mock.calls[0] as unknown[])[0]).toEqual([
      expect.objectContaining({ path: 'content/tuning.toml' }),
    ])
    await userEvent.click(screen.getByRole('tab', { name: 'Levels' }))
    expect(screen.queryByText('sliders: tuning session')).toBeNull()
    await userEvent.click(screen.getByRole('tab', { name: 'Tuner' }))
    expect(await screen.findByText('sliders: tuning session')).toBeInTheDocument()
    expect(open).toHaveBeenCalledTimes(1)
  })
})
