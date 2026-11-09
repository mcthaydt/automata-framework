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
import type {
  GamePublish,
  PlaceInfo,
  PlaceResult,
  PublishResult,
} from '#src/shared/kit/storage/publish-client.ts'
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

async function start(options: { playUrl?: string; playOff?: string; publish?: GamePublish } = {}) {
  const env = options
  const files = { ...tunerFixtureFiles(), [EDITOR_LIST_PATH]: LIST }
  const load = loadEditorList(LIST)
  if (!load.ok) throw new Error('the test list does not load')
  const { ports } = await createMemoryPorts({
    files,
    classify: (path) => workspaceFile(load.list, path),
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

const ITCH: PlaceInfo = {
  id: 'itch',
  name: 'itch.io',
  asks: [{ id: 'page', label: 'Your itch.io page', example: 'your-name.itch.io/my-game' }],
  note: 'On your itch.io page, set its kind to HTML. Without that, itch.io will not play the game.',
  signIn: true,
}

function fakePublish(
  results: PublishResult[],
  placing: {
    places?: PlaceInfo[]
    put?: PlaceResult[]
    onThisComputer?: boolean
    signIn?: { ok: true } | { ok: false; problem: string; link?: string }
  } = {},
) {
  const downloads: string[] = []
  const puts: { id: string; answers: Record<string, string> }[] = []
  const signIns: string[] = []
  let call = 0
  let putCall = 0
  const publish: GamePublish = {
    places: async () => placing.places ?? [],
    putInPlace: vi.fn(async (id: string, answers: Readonly<Record<string, string>>): Promise<PlaceResult> => {
      puts.push({ id, answers: { ...answers } })
      return placing.put?.[putCall++] ?? { ok: false, need: 'push', problem: 'no more' }
    }),
    signInAtPlace: vi.fn(async (id: string) => {
      signIns.push(id)
      return placing.signIn ?? { ok: true as const }
    }),
    onThisComputer: placing.onThisComputer ?? true,
    publish: vi.fn(
      async (): Promise<PublishResult> => results[call++] ?? { ok: false, problem: 'no more', detail: '' },
    ),
    download: vi.fn(async (name: string) => {
      downloads.push(name)
    }),
  }
  return { publish, downloads, puts, signIns }
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
    await user.click(await screen.findByRole('menuitem', { name: 'Publish' }))
    expect(await screen.findByRole('dialog', { name: 'Publish your game' })).toBeInTheDocument()
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

  it('has no Game menu when there is neither a game to play nor one to publish', async () => {
    setSize(390, 844)
    await start()
    await screen.findByRole('button', { name: 'Home' })
    expect(screen.queryByRole('button', { name: 'Game' })).toBeNull()
  })
})

describe('Publish on a game', () => {
  it('makes the zip and hands it over, saying where to upload it', async () => {
    const user = userEvent.setup()
    const { publish, downloads } = fakePublish([{ ok: true, name: 'my-game-0.1.0-itch.zip' }])
    await start({ publish })
    await user.click(await screen.findByRole('button', { name: 'Publish' }))
    const dialog = await screen.findByRole('dialog', { name: 'Publish your game' })
    expect(dialog).toHaveTextContent(
      'you choose where to put it, or download the zip and upload it to itch.io or any website host',
    )
    await user.click(screen.getByRole('button', { name: 'Make my zip' }))
    expect(await screen.findByText('Your game is ready to upload.')).toBeInTheDocument()
    expect(dialog).toHaveTextContent('choose HTML as its kind')
    // The way to do it, step by step, is one link away.
    expect(screen.getByRole('link', { name: 'How to put it on itch.io' })).toHaveAttribute(
      'href',
      'https://automataframework.com/docs/publish-to-itch',
    )
    await user.click(screen.getByRole('button', { name: 'Download the zip' }))
    expect(downloads).toEqual(['my-game-0.1.0-itch.zip'])
  })

  it('never says "build" to someone who is not a programmer, whatever step it is on', async () => {
    const user = userEvent.setup()
    const { publish } = fakePublish([{ ok: true, name: 'my-game-0.1.0-itch.zip' }])
    await start({ publish })
    await user.click(await screen.findByRole('button', { name: 'Publish' }))
    const dialog = await screen.findByRole('dialog', { name: 'Publish your game' })
    expect(dialog.textContent).not.toMatch(/build/i)
    await user.click(screen.getByRole('button', { name: 'Make my zip' }))
    await screen.findByText('Your game is ready to upload.')
    expect(dialog.textContent).not.toMatch(/build/i)
  })

  it('says it is making the zip while it works, in plain words', async () => {
    const user = userEvent.setup()
    let finish: (result: PublishResult) => void = () => {}
    const publish: GamePublish = {
      publish: () => new Promise((done) => (finish = done)),
      download: async () => {},
      places: async () => [],
      putInPlace: async () => ({ ok: false, need: 'push', problem: '' }),
      signInAtPlace: async () => ({ ok: true }),
      onThisComputer: true,
    }
    await start({ publish })
    await user.click(await screen.findByRole('button', { name: 'Publish' }))
    await user.click(await screen.findByRole('button', { name: 'Make my zip' }))
    const dialog = await screen.findByRole('dialog', { name: 'Publish your game' })
    expect(dialog).toHaveTextContent('Making your game’s zip…')
    expect(dialog.textContent).not.toMatch(/build/i)
    finish({ ok: true, name: 'a.zip' })
    await screen.findByText('Your game is ready to upload.')
  })

  it('says what stopped it, and lets the person try again', async () => {
    const user = userEvent.setup()
    const { publish } = fakePublish([
      {
        ok: false,
        problem: 'Your game could not be put together. Fix what the lines below say, then try again.',
        detail: 'src/main.ts:3: Unexpected token',
      },
      { ok: true, name: 'my-game-0.1.0-itch.zip' },
    ])
    await start({ publish })
    await user.click(await screen.findByRole('button', { name: 'Publish' }))
    await user.click(await screen.findByRole('button', { name: 'Make my zip' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Your game could not be put together.')
    expect(screen.getByText('src/main.ts:3: Unexpected token')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(screen.getByText('Your game is ready to upload.')).toBeInTheDocument())
  })

  it('has no Publish when the editor cannot publish the game', async () => {
    await start()
    await screen.findByText('My game')
    expect(screen.queryByRole('button', { name: 'Publish' })).toBeNull()
  })

  it('after the zip, asks where to put the game: itch.io first, with its page address asked once and an example', async () => {
    const user = userEvent.setup()
    const { publish, puts } = fakePublish([{ ok: true, name: 'my-game-0.1.0-itch.zip' }], {
      places: [ITCH],
      put: [{ ok: true, link: 'https://your-name.itch.io/my-game' }],
    })
    await start({ publish })
    await user.click(await screen.findByRole('button', { name: 'Publish' }))
    const dialog = await screen.findByRole('dialog', { name: 'Publish your game' })
    // Before the zip exists, there is nowhere to put it.
    expect(screen.queryByLabelText(/Your itch.io page/)).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Make my zip' }))
    expect(await screen.findByLabelText(/Your itch.io page/)).toBeInTheDocument()
    expect(dialog).toHaveTextContent('set its kind to HTML')
    expect(dialog).toHaveTextContent('Like your-name.itch.io/my-game')
    await user.type(screen.getByLabelText(/Your itch.io page/), 'your-name.itch.io/my-game')
    await user.click(screen.getByRole('button', { name: 'Put it on itch.io' }))
    expect(await screen.findByText('Your game is on itch.io.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'https://your-name.itch.io/my-game' })).toHaveAttribute(
      'target',
      '_blank',
    )
    expect(puts).toEqual([{ id: 'itch', answers: { page: 'your-name.itch.io/my-game' } }])
    // The zip can still be kept, whatever happened there.
    expect(screen.getByRole('button', { name: 'Download the zip' })).toBeInTheDocument()
    expect(dialog.textContent).not.toMatch(/build/i)
  })

  it('copies the game’s link', async () => {
    const user = userEvent.setup()
    const { publish } = fakePublish([{ ok: true, name: 'a.zip' }], {
      places: [ITCH],
      put: [{ ok: true, link: 'https://your-name.itch.io/my-game' }],
    })
    await start({ publish })
    await user.click(await screen.findByRole('button', { name: 'Publish' }))
    await user.click(await screen.findByRole('button', { name: 'Make my zip' }))
    await user.type(await screen.findByLabelText(/Your itch.io page/), 'your-name.itch.io/my-game')
    await user.click(screen.getByRole('button', { name: 'Put it on itch.io' }))
    const write = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
    await user.click(await screen.findByRole('button', { name: 'Copy link' }))
    expect(write).toHaveBeenCalledWith('https://your-name.itch.io/my-game')
    expect(await screen.findByRole('button', { name: 'Link copied' })).toBeInTheDocument()
  })

  it('says to get the uploader, with a link, when butler is missing', async () => {
    const user = userEvent.setup()
    const { publish } = fakePublish([{ ok: true, name: 'a.zip' }], {
      places: [ITCH],
      put: [
        {
          ok: false,
          need: 'butler',
          problem: 'butler, itch.io’s uploader, is not on this computer yet. Get it, then try again.',
          help: { label: 'Get itch.io’s uploader', href: 'https://itch.io/docs/butler/installing.html' },
        },
      ],
    })
    await start({ publish })
    await user.click(await screen.findByRole('button', { name: 'Publish' }))
    await user.click(await screen.findByRole('button', { name: 'Make my zip' }))
    await user.type(await screen.findByLabelText(/Your itch.io page/), 'a/b')
    await user.click(screen.getByRole('button', { name: 'Put it on itch.io' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'butler, itch.io’s uploader, is not on this computer yet',
    )
    expect(screen.getByRole('link', { name: 'Get itch.io’s uploader' })).toHaveAttribute(
      'href',
      'https://itch.io/docs/butler/installing.html',
    )
  })

  it('offers a sign-in button, then tries again once signed in', async () => {
    const user = userEvent.setup()
    const { publish, puts, signIns } = fakePublish([{ ok: true, name: 'a.zip' }], {
      places: [ITCH],
      put: [
        {
          ok: false,
          need: 'account',
          problem: 'Sign in to itch.io first, then press Put it on itch.io again.',
        },
        { ok: true, link: 'https://a.itch.io/b' },
      ],
    })
    await start({ publish })
    await user.click(await screen.findByRole('button', { name: 'Publish' }))
    await user.click(await screen.findByRole('button', { name: 'Make my zip' }))
    await user.type(await screen.findByLabelText(/Your itch.io page/), 'a/b')
    await user.click(screen.getByRole('button', { name: 'Put it on itch.io' }))
    await user.click(await screen.findByRole('button', { name: 'Sign in to itch.io' }))
    expect(await screen.findByText('Your game is on itch.io.')).toBeInTheDocument()
    expect(signIns).toEqual(['itch'])
    expect(puts).toHaveLength(2)
  })

  it('over the network, sends the person to finish signing in on their computer', async () => {
    const user = userEvent.setup()
    const { publish } = fakePublish([{ ok: true, name: 'a.zip' }], {
      places: [ITCH],
      onThisComputer: false,
      put: [
        {
          ok: false,
          need: 'account',
          problem: 'Sign in to itch.io first, then press Put it on itch.io again.',
        },
      ],
    })
    await start({ publish })
    await user.click(await screen.findByRole('button', { name: 'Publish' }))
    await user.click(await screen.findByRole('button', { name: 'Make my zip' }))
    await user.type(await screen.findByLabelText(/Your itch.io page/), 'a/b')
    await user.click(screen.getByRole('button', { name: 'Put it on itch.io' }))
    expect(await screen.findByText(/Finish signing in on your computer/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sign in to itch.io' })).toBeNull()
  })

  it('links to make the page when the address is not one', async () => {
    const user = userEvent.setup()
    const { publish } = fakePublish([{ ok: true, name: 'a.zip' }], {
      places: [ITCH],
      put: [
        {
          ok: false,
          need: 'project',
          problem: 'That does not look like an itch.io page address.',
          help: { label: 'Make a page on itch.io', href: 'https://itch.io/game/new' },
        },
      ],
    })
    await start({ publish })
    await user.click(await screen.findByRole('button', { name: 'Publish' }))
    await user.click(await screen.findByRole('button', { name: 'Make my zip' }))
    await user.type(await screen.findByLabelText(/Your itch.io page/), 'nonsense')
    await user.click(screen.getByRole('button', { name: 'Put it on itch.io' }))
    expect(await screen.findByRole('link', { name: 'Make a page on itch.io' })).toHaveAttribute(
      'href',
      'https://itch.io/game/new',
    )
  })

  it('with one place, shows no chooser: its questions are already there', async () => {
    const user = userEvent.setup()
    const { publish } = fakePublish([{ ok: true, name: 'a.zip' }], { places: [ITCH] })
    await start({ publish })
    await user.click(await screen.findByRole('button', { name: 'Publish' }))
    await user.click(await screen.findByRole('button', { name: 'Make my zip' }))
    await screen.findByLabelText(/Your itch.io page/)
    expect(screen.queryByRole('button', { name: 'itch.io' })).toBeNull()
    expect(screen.queryByText('Where do you want to put it?')).toBeNull()
    expect(screen.getByRole('button', { name: 'Put it on itch.io' })).toBeInTheDocument()
  })

  it('with two places, shows a chooser and waits for a choice', async () => {
    const user = userEvent.setup()
    const host: PlaceInfo = { id: 'host', name: 'My web host', asks: [], signIn: false }
    const { publish } = fakePublish([{ ok: true, name: 'a.zip' }], { places: [ITCH, host] })
    await start({ publish })
    await user.click(await screen.findByRole('button', { name: 'Publish' }))
    await user.click(await screen.findByRole('button', { name: 'Make my zip' }))
    await screen.findByText('Where do you want to put it?')
    expect(screen.queryByLabelText(/Your itch.io page/)).toBeNull()
    await user.click(screen.getByRole('button', { name: 'itch.io' }))
    expect(screen.getByLabelText(/Your itch.io page/)).toBeInTheDocument()
  })

  it('shows one green button at a time: Sign in replaces Put it on itch.io', async () => {
    const user = userEvent.setup()
    const { publish } = fakePublish([{ ok: true, name: 'a.zip' }], {
      places: [ITCH],
      put: [
        {
          ok: false,
          need: 'account',
          problem: 'Sign in to itch.io first, then press Put it on itch.io again.',
        },
      ],
    })
    await start({ publish })
    await user.click(await screen.findByRole('button', { name: 'Publish' }))
    await user.click(await screen.findByRole('button', { name: 'Make my zip' }))
    await user.type(await screen.findByLabelText(/Your itch.io page/), 'a/b')
    expect(screen.queryByRole('button', { name: 'Sign in to itch.io' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Put it on itch.io' }))
    expect(await screen.findByRole('button', { name: 'Sign in to itch.io' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Put it on itch.io' })).toBeNull()
  })

  it('says to make the page, under the field, before anything has failed', async () => {
    const user = userEvent.setup()
    const place: PlaceInfo = {
      ...ITCH,
      makePage: { label: 'Make one on itch.io', href: 'https://itch.io/game/new' },
    }
    const { publish } = fakePublish([{ ok: true, name: 'a.zip' }], { places: [place] })
    await start({ publish })
    await user.click(await screen.findByRole('button', { name: 'Publish' }))
    await user.click(await screen.findByRole('button', { name: 'Make my zip' }))
    expect(await screen.findByText(/No page yet\?/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Make one on itch.io' })).toHaveAttribute(
      'href',
      'https://itch.io/game/new',
    )
  })

  it('fills the page address in from what the game already holds, so it is asked once', async () => {
    const user = userEvent.setup()
    const place: PlaceInfo = { ...ITCH, known: { page: 'sam.itch.io/coin-run' } }
    const { publish, puts } = fakePublish([{ ok: true, name: 'a.zip' }], {
      places: [place],
      put: [{ ok: true, link: 'https://sam.itch.io/coin-run' }],
    })
    await start({ publish })
    await user.click(await screen.findByRole('button', { name: 'Publish' }))
    await user.click(await screen.findByRole('button', { name: 'Make my zip' }))
    expect(await screen.findByLabelText(/Your itch.io page/)).toHaveValue('sam.itch.io/coin-run')
    await user.click(screen.getByRole('button', { name: 'Put it on itch.io' }))
    await screen.findByText('Your game is on itch.io.')
    expect(puts).toEqual([{ id: 'itch', answers: { page: 'sam.itch.io/coin-run' } }])
  })

  it('says a new page is private until it is made Public, once the game is there', async () => {
    const user = userEvent.setup()
    const place: PlaceInfo = {
      ...ITCH,
      afterNote: 'Only you can see it until you set the page to Public on itch.io.',
    }
    const { publish } = fakePublish([{ ok: true, name: 'a.zip' }], {
      places: [place],
      put: [{ ok: true, link: 'https://a.itch.io/b' }],
    })
    await start({ publish })
    await user.click(await screen.findByRole('button', { name: 'Publish' }))
    await user.click(await screen.findByRole('button', { name: 'Make my zip' }))
    expect(screen.queryByText(/until you set the page to Public/)).toBeNull()
    await user.type(await screen.findByLabelText(/Your itch.io page/), 'a/b')
    await user.click(screen.getByRole('button', { name: 'Put it on itch.io' }))
    expect(await screen.findByText(/until you set the page to Public/)).toBeInTheDocument()
  })

  it('when signing in does not finish, says so and shows the address to open by hand', async () => {
    const user = userEvent.setup()
    const { publish } = fakePublish([{ ok: true, name: 'a.zip' }], {
      places: [ITCH],
      put: [
        {
          ok: false,
          need: 'account',
          problem: 'Sign in to itch.io first, then press Put it on itch.io again.',
        },
      ],
      signIn: {
        ok: false,
        problem: 'Signing in did not finish. Try again.',
        link: 'https://itch.io/user/oauth?x=1',
      },
    })
    await start({ publish })
    await user.click(await screen.findByRole('button', { name: 'Publish' }))
    await user.click(await screen.findByRole('button', { name: 'Make my zip' }))
    await user.type(await screen.findByLabelText(/Your itch.io page/), 'a/b')
    await user.click(screen.getByRole('button', { name: 'Put it on itch.io' }))
    await user.click(await screen.findByRole('button', { name: 'Sign in to itch.io' }))
    expect(await screen.findByText('Signing in did not finish. Try again.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'https://itch.io/user/oauth?x=1' })).toHaveAttribute(
      'href',
      'https://itch.io/user/oauth?x=1',
    )
    // The button is back, so the person can try again.
    expect(screen.getByRole('button', { name: 'Sign in to itch.io' })).toBeEnabled()
  })

  it('says it is waiting for the person while the sign-in is open', async () => {
    const user = userEvent.setup()
    let finish: () => void = () => {}
    const { publish } = fakePublish([{ ok: true, name: 'a.zip' }], {
      places: [ITCH],
      put: [
        {
          ok: false,
          need: 'account',
          problem: 'Sign in to itch.io first, then press Put it on itch.io again.',
        },
        { ok: true, link: 'https://a.itch.io/b' },
      ],
    })
    publish.signInAtPlace = () => new Promise((done) => (finish = () => done({ ok: true })))
    await start({ publish })
    await user.click(await screen.findByRole('button', { name: 'Publish' }))
    await user.click(await screen.findByRole('button', { name: 'Make my zip' }))
    await user.type(await screen.findByLabelText(/Your itch.io page/), 'a/b')
    await user.click(screen.getByRole('button', { name: 'Put it on itch.io' }))
    await user.click(await screen.findByRole('button', { name: 'Sign in to itch.io' }))
    expect(await screen.findByText(/Finish signing in in the page that opened/)).toBeInTheDocument()
    finish()
    expect(await screen.findByText('Your game is on itch.io.')).toBeInTheDocument()
  })

  it('keeps the plain download when the server lists no place', async () => {
    const user = userEvent.setup()
    const { publish } = fakePublish([{ ok: true, name: 'a.zip' }])
    await start({ publish })
    await user.click(await screen.findByRole('button', { name: 'Publish' }))
    await user.click(await screen.findByRole('button', { name: 'Make my zip' }))
    await screen.findByText('Your game is ready to upload.')
    expect(screen.queryByRole('button', { name: /Put it on/ })).toBeNull()
    expect(screen.getByRole('button', { name: 'Download the zip' })).toBeInTheDocument()
  })
})
