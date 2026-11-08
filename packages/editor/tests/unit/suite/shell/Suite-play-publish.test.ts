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

async function start(
  options: { playUrl?: string; playOff?: string; publish?: GamePublish; changeSet?: boolean } = {},
) {
  const { changeSet = false, ...env } = options
  // A served game has no change set (`false`); a sample game has one (left out).
  const files = { ...tunerFixtureFiles(), [EDITOR_LIST_PATH]: LIST }
  const load = loadEditorList(LIST)
  if (!load.ok) throw new Error('the test list does not load')
  const { ports } = await createMemoryPorts({
    files,
    classify: (path) => workspaceFile(load.list, path),
    ...(changeSet ? {} : { changeSet: false as const }),
  })
  const target = document.body.appendChild(document.createElement('div'))
  started = await startSuite(target, {
    window,
    document,
    ports,
    suite: createSuite({ editors: [createTuner() as SuiteEditor<unknown>] }),
    game: 'My game',
    ...env,
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

const NOT_INSTALLED =
  'Your game’s packages are not installed. Run pnpm install in its folder, then start the editor again.'

describe('Play, when the game could not start', () => {
  it('stays on the bar, and pressing it says why in words and what to do', async () => {
    const user = userEvent.setup()
    await start({ playOff: NOT_INSTALLED })
    expect(screen.queryByRole('link', { name: 'Play' })).toBeNull()
    const play = await screen.findByRole('button', { name: 'Play' })
    expect(play).toHaveAttribute('aria-disabled', 'true')
    await user.click(play)
    const dialog = await screen.findByRole('dialog', { name: 'Play is off' })
    expect(dialog).toHaveTextContent(NOT_INSTALLED)
    await user.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('puts the first line in words and the rest, such as what the game printed, under it', async () => {
    const user = userEvent.setup()
    await start({ playOff: 'Your game stopped before it started:\nsrc/main.ts:3: Unexpected token' })
    await user.click(await screen.findByRole('button', { name: 'Play' }))
    expect(await screen.findByText('Your game stopped before it started:')).toBeInTheDocument()
    expect(screen.getByText('src/main.ts:3: Unexpected token')).toBeInTheDocument()
  })

  it('shows no Play-off button when the game is running', async () => {
    await start({ playUrl: 'http://localhost:5199/' })
    await screen.findByRole('link', { name: 'Play' })
    expect(screen.queryByRole('button', { name: 'Play' })).toBeNull()
  })
})

describe('on a phone, where the bar has no room for two more buttons', () => {
  const size = { width: window.innerWidth, height: window.innerHeight }
  const setSize = (width: number, height: number) => {
    Object.assign(window, { innerWidth: width, innerHeight: height })
  }
  afterEach(() => setSize(size.width, size.height))

  it('puts Play and Publish in one Game menu, whole and named', async () => {
    const user = userEvent.setup()
    setSize(390, 844)
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    const { publish } = fakePublish([])
    await start({ playUrl: 'http://localhost:5199/', publish })
    const game = await screen.findByRole('button', { name: 'Game' })
    expect(screen.queryByRole('link', { name: 'Play' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Publish' })).toBeNull()
    await user.click(game)
    await user.click(await screen.findByRole('menuitem', { name: 'Play your game' }))
    expect(open).toHaveBeenCalledWith('http://localhost:5199/', '_blank', 'noopener')
    await user.click(await screen.findByRole('button', { name: 'Game' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Make it ready to upload' }))
    expect(await screen.findByRole('dialog', { name: 'Make your game ready to upload' })).toBeInTheDocument()
    open.mockRestore()
  })

  it('keeps Play in the menu marked Off, and pressing it says why once the menu has closed', async () => {
    const user = userEvent.setup()
    setSize(390, 844)
    const { publish } = fakePublish([])
    await start({ playOff: NOT_INSTALLED, publish })
    await user.click(await screen.findByRole('button', { name: 'Game' }))
    const item = await screen.findByRole('menuitem', { name: /Play your game/ })
    expect(item).toHaveTextContent('Off')
    await user.click(item)
    expect(await screen.findByRole('dialog', { name: 'Play is off' })).toHaveTextContent(NOT_INSTALLED)
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('keeps the change set’s Publish a Publish button: the Game menu is for the game’s own zip only', async () => {
    setSize(390, 844)
    await start({ changeSet: true })
    expect(await screen.findByRole('button', { name: 'Publish' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Game' })).toBeNull()
  })

  it('has no Game menu when there is neither a game to play nor one to publish', async () => {
    setSize(390, 844)
    await start()
    await screen.findByRole('button', { name: 'Home' })
    expect(screen.queryByRole('button', { name: 'Game' })).toBeNull()
  })
})

describe('Publish on a game', () => {
  it('builds the game and hands over the zip, saying where to upload it', async () => {
    const user = userEvent.setup()
    const { publish, downloads } = fakePublish([{ ok: true, name: 'my-game-0.1.0-itch.zip' }])
    await start({ publish })
    await user.click(await screen.findByRole('button', { name: 'Publish' }))
    const dialog = await screen.findByRole('dialog', { name: 'Make your game ready to upload' })
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
