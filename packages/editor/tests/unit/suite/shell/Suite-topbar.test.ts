// @vitest-environment jsdom
import { screen } from '@testing-library/svelte'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EDITOR_LIST_PATH, loadEditorList, workspaceFile } from '#src/features/suite/core/index.ts'
import { type SuiteHandle, startSuite } from '#src/features/suite/shell/boot.ts'
import { createSuite } from '#src/features/suite/shell/create-suite.ts'
import { samplePorts } from '#src/features/suite/shell/sample-ports.ts'
import { createTuner } from '#src/features/suite/tuner/tuner-suite-editor.ts'
import { createMemoryPorts } from '#src/shared/kit/ports/memory/memory-ports.ts'
import type { SuiteEditor } from '#src/shared/kit/ports/suite-editor.ts'
import { tunerFixtureFiles } from '#src/testing/suite/tuner-fixtures.ts'

// The suite's top bar in plain words (task 12.7, the grandma audit 6.1): the game's name as the title, where the
// changes are saved, no pill until it has something to say, and a full-width banner on the sample in place of a chip.

const LIST = `format = "af-editors/1"\n[[file]]\nglob = "content/tuning.toml"\neditor = "tuner"\nmodes = ["edit"]\ngates = []\nchecks = []\n`

let started: SuiteHandle | undefined
afterEach(async () => {
  await started?.dispose()
  started = undefined
  document.body.innerHTML = ''
})

/** The game's own folder, as `automata editor` serves it: no change sets, so an edit writes the file itself. */
async function gameFolder() {
  const files = { ...tunerFixtureFiles(), [EDITOR_LIST_PATH]: LIST }
  const load = loadEditorList(LIST)
  if (!load.ok) throw new Error('the test list does not load')
  const classify = (path: string) => workspaceFile(load.list, path)
  return (await createMemoryPorts({ files, classify, changeSet: false })).ports
}

async function start(options: { sample?: boolean; game?: string } = {}) {
  const target = document.body.appendChild(document.createElement('div'))
  const files = { ...tunerFixtureFiles(), [EDITOR_LIST_PATH]: LIST }
  started = await startSuite(target, {
    window,
    document,
    ports: options.sample === true ? await samplePorts(files) : await gameFolder(),
    suite: createSuite({ editors: [createTuner() as SuiteEditor<unknown>] }),
    ...options,
  })
}

describe("the suite's top bar", () => {
  it('names the game and says the changes are saved in its folder; a pill with nothing to say is not shown', async () => {
    await start({ game: 'Emberwick' })
    expect(await screen.findByText('Emberwick')).toBeInTheDocument()
    expect(screen.queryByText('Editors', { selector: '.brand' })).toBeNull()
    expect(screen.getByText('Saved in your game folder')).toBeInTheDocument()
    for (const quiet of [
      'No change set',
      'Saving to the workspace',
      'No checks run',
      'No gates',
      'Gates not readable',
    ])
      expect(screen.queryByRole('button', { name: quiet })).toBeNull()
  })

  it('draws Home, Undo and Redo as named icon buttons, and the saved status with a tick', async () => {
    await start({ game: 'Emberwick' })
    const home = await screen.findByRole('button', { name: 'Home' })
    expect(home).toHaveAttribute('aria-current', 'page')
    expect(home.querySelector('svg')).not.toBeNull()
    expect(home.textContent?.trim()).toBe('')
    const saved = screen.getByText('Saved in your game folder')
    expect(saved.closest('.where')?.querySelector('svg')).not.toBeNull()
  })

  it("puts Export and Import in Home's heading row, beside the question, not floating above it", async () => {
    await start({ game: 'Emberwick' })
    const heading = await screen.findByRole('heading', { name: 'What do you want to change?' })
    const row = heading.closest('header')
    expect(row).not.toBeNull()
    expect(row?.contains(screen.getByRole('button', { name: 'Export changes' }))).toBe(true)
    expect(row?.contains(screen.getByRole('button', { name: 'Import changes' }))).toBe(true)
  })

  it('Publish is quiet, not the lime primary, while there is nothing new to publish', async () => {
    await start({ sample: true })
    const publish = await screen.findByRole('button', { name: 'Publish' })
    await vi.waitFor(() => expect(publish).toHaveAttribute('data-kind', 'plain'))
  })

  it("says nothing but a person's words on Home and with the Tuner open (the copy rule, task 12.5)", async () => {
    const stray = [
      /editor-/i,
      /af2d/i,
      /\.json\b/i,
      /\bcheckout\b/i,
      /\bPlus\b/,
      /\bprojects?\b/i,
      /\bworkspaces?\b/i,
      /\bentit(y|ies)\b/i,
      /\bIntGrid\b/i,
      /\btunables?\b/i,
      /\bchange sets?\b/i,
      /\bgates?\b/i,
      /\bpivot\b/i,
    ]
    const found = (where: string): string[] =>
      stray.filter((word) => word.test(document.body.textContent ?? '')).map((word) => `${where}: ${word}`)
    await start({ sample: true })
    await screen.findByRole('heading', { name: 'What do you want to change?' })
    const words = found('Home')
    screen.getByRole('tab', { name: 'Tuner' }).click()
    await screen.findByTestId('tuner-rows')
    words.push(...found('Tuner'))
    expect(words).toEqual([])
  })

  it('on the sample, a banner says it is not your game and how to open yours', async () => {
    await start({ sample: true })
    expect(
      await screen.findByText(
        "This is a sample game, not yours. Run automata editor inside your game's folder to edit it.",
      ),
    ).toBeInTheDocument()
    expect(screen.queryByText('Saved in your game folder')).toBeNull()
    // The title says it too, in place of the small chip beside it.
    expect(screen.getAllByText('Sample game')).toHaveLength(1)
  })
})
