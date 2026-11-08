// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EDITOR_LIST_PATH, loadEditorList, workspaceFile } from '#src/features/suite/core/index.ts'
import { createMemoryPorts } from '#src/features/suite/memory/memory-ports.ts'
import { type SuiteHandle, startSuite } from '#src/features/suite/shell/boot.ts'
import { createSuite } from '#src/features/suite/shell/create-suite.ts'
import { createTuner } from '#src/features/suite/tuner/tuner-suite-editor.ts'
import type { SuiteEditor } from '#src/shared/kit/ports/suite-editor.ts'
import type { GamePublish, PublishResult } from '#src/shared/kit/storage/publish-client.ts'
import { tunerFixtureFiles } from '#src/testing/suite/tuner-fixtures.ts'

// Play and Publish on a game's own folder: `automata editor` runs the game beside the editor, so Play opens it, and
// Publish builds it into one zip to upload. Both say what they do in words a first-time maker can follow.

const LIST = `format = "af-editors/1"\n[[file]]\nglob = "content/tuning.toml"\neditor = "tuner"\nmodes = ["edit"]\ngates = []\nchecks = []\n`

let started: SuiteHandle | undefined
afterEach(async () => {
  await started?.dispose()
  started = undefined
  document.body.innerHTML = ''
})

async function start(options: { playUrl?: string; publish?: GamePublish } = {}) {
  const files = { ...tunerFixtureFiles(), [EDITOR_LIST_PATH]: LIST }
  const load = loadEditorList(LIST)
  if (!load.ok) throw new Error('the test list does not load')
  const { ports } = await createMemoryPorts({
    files,
    classify: (path) => workspaceFile(load.list, path),
    changeSet: false,
  })
  const target = document.body.appendChild(document.createElement('div'))
  started = await startSuite(target, {
    window,
    document,
    ports,
    suite: createSuite({ editors: [createTuner() as SuiteEditor<unknown>] }),
    game: 'My game',
    ...options,
  })
}

function fakePublish(results: PublishResult[]) {
  const downloads: string[] = []
  let call = 0
  const publish: GamePublish = {
    publish: vi.fn(
      async (): Promise<PublishResult> => results[call++] ?? { ok: false, problem: 'no more', detail: '' },
    ),
    download: vi.fn(async (name: string) => {
      downloads.push(name)
    }),
  }
  return { publish, downloads }
}

describe('Play', () => {
  it('opens the running game in a new tab', async () => {
    await start({ playUrl: 'http://localhost:5199/' })
    const play = await screen.findByRole('link', { name: 'Play' })
    expect(play).toHaveAttribute('href', 'http://localhost:5199/')
    expect(play).toHaveAttribute('target', '_blank')
  })

  it('is not shown when the game is not running', async () => {
    await start()
    await screen.findByText('My game')
    expect(screen.queryByRole('link', { name: 'Play' })).toBeNull()
  })
})

describe('Publish on a game', () => {
  it('builds the game and hands over the zip, saying where to upload it', async () => {
    const user = userEvent.setup()
    const { publish, downloads } = fakePublish([{ ok: true, name: 'my-game-0.1.0-itch.zip' }])
    await start({ publish })
    await user.click(await screen.findByRole('button', { name: 'Publish' }))
    const dialog = await screen.findByRole('dialog', { name: 'Put your game online' })
    expect(dialog).toHaveTextContent('one zip file to upload to itch.io or any website host')
    await user.click(screen.getByRole('button', { name: 'Build my game' }))
    expect(await screen.findByText('Your game is ready to upload.')).toBeInTheDocument()
    expect(dialog).toHaveTextContent('choose HTML as its kind')
    await user.click(screen.getByRole('button', { name: 'Download the zip' }))
    expect(downloads).toEqual(['my-game-0.1.0-itch.zip'])
  })

  it('says what stopped the build, and lets the person try again', async () => {
    const user = userEvent.setup()
    const { publish } = fakePublish([
      {
        ok: false,
        problem: 'Your game did not build. Fix what the lines below say, then try again.',
        detail: 'src/main.ts:3: Unexpected token',
      },
      { ok: true, name: 'my-game-0.1.0-itch.zip' },
    ])
    await start({ publish })
    await user.click(await screen.findByRole('button', { name: 'Publish' }))
    await user.click(await screen.findByRole('button', { name: 'Build my game' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Your game did not build.')
    expect(screen.getByText('src/main.ts:3: Unexpected token')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(screen.getByText('Your game is ready to upload.')).toBeInTheDocument())
  })

  it('has no Publish when the editor cannot publish the game', async () => {
    await start()
    await screen.findByText('My game')
    expect(screen.queryByRole('button', { name: 'Publish' })).toBeNull()
  })
})
