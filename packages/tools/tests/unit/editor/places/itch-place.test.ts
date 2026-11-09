import { describe, expect, it } from 'vitest'
import {
  createItchPlace,
  type ItchPlaceDeps,
  pageToProject,
  withItchProject,
} from '#src/features/editor/places/itch-place.ts'

// itch.io, the first place Publish offers. butler is itch.io's own uploader; the person signs in to itch.io with it
// and nothing here keeps their key. Every outcome says what the person does next, in words.

const CONFIG = `import { defineShipConfig } from '@automata/tools'

export default defineShipConfig({
  game: { id: 'my-game', title: 'My game', version: '0.1.0', entry: 'index.html' },
  itch: { project: 'your-itch-user/my-game', channel: 'html5' },
})
`

function setup(overrides: Partial<ItchPlaceDeps> = {}, config: string | undefined = CONFIG) {
  const files = new Map<string, string>(config === undefined ? [] : [['/game/ship.config.ts', config]])
  const runs: { command: string; args: readonly string[] }[] = []
  const deps: ItchPlaceDeps = {
    findButler: () => '/bin/butler',
    signedIn: () => true,
    run: async (command, args) => {
      runs.push({ command, args })
      return { code: 0, output: 'pushing' }
    },
    read: (path) => files.get(path),
    write: (path, text) => void files.set(path, text),
    version: () => '0.1.0',
    ...overrides,
  }
  return { place: createItchPlace(deps), files, runs }
}

const put = (place: ReturnType<typeof setup>['place'], page = 'Your-Name.itch.io/my-game') =>
  place.put('/game', '/game/my-game-0.1.0-itch.zip', { page })

describe('pageToProject', () => {
  it.each([
    ['your-name.itch.io/my-game', 'your-name/my-game'],
    ['https://your-name.itch.io/my-game/', 'your-name/my-game'],
    ['Your-Name.itch.io/My-Game', 'your-name/my-game'],
    ['your-name/my-game', 'your-name/my-game'],
  ])('reads %s as %s', (page, project) => expect(pageToProject(page)).toBe(project))

  it.each(['', 'itch.io', 'my game', 'https://example.com/a/b/c', 'your-name.itch.io'])(
    'does not read %j',
    (page) => expect(pageToProject(page)).toBeUndefined(),
  )
})

describe('withItchProject', () => {
  it('changes the project of the itch section and keeps the rest', () => {
    expect(withItchProject(CONFIG, 'sam/coin-run')).toBe(
      CONFIG.replace('your-itch-user/my-game', 'sam/coin-run'),
    )
  })

  it('adds the section to a game made without the itch target', () => {
    const bare = CONFIG.replace("  itch: { project: 'your-itch-user/my-game', channel: 'html5' },\n", '')
    const edited = withItchProject(bare, 'sam/coin-run')
    expect(edited).toContain("itch: { project: 'sam/coin-run', channel: 'html5' },")
    expect(edited.trimEnd().endsWith('})')).toBe(true)
  })
})

describe('the itch.io place', () => {
  it('is named itch.io and asks for one thing, the page’s address, with an example', () => {
    const { place } = setup()
    expect(place.id).toBe('itch')
    expect(place.name).toBe('itch.io')
    expect(place.asks).toEqual([
      { id: 'page', label: 'Your itch.io page', example: 'your-name.itch.io/my-game' },
    ])
  })

  it('tells the person, before the first push, to set the page’s kind to HTML', () => {
    expect(setup().place.note).toContain('set its kind to HTML')
  })

  it('pushes the zip with butler and gives back the page’s link', async () => {
    const { place, runs, files } = setup()
    expect(await put(place)).toEqual({ ok: true, link: 'https://your-name.itch.io/my-game' })
    expect(runs).toEqual([
      {
        command: '/bin/butler',
        args: [
          'push',
          '/game/my-game-0.1.0-itch.zip',
          'your-name/my-game:html5',
          '--userversion',
          '0.1.0',
          '--if-changed',
        ],
      },
    ])
    expect(files.get('/game/ship.config.ts')).toContain("project: 'your-name/my-game'")
  })

  it('writes nothing but ship.config.ts, and no key anywhere', async () => {
    const { place, files } = setup()
    await put(place)
    expect([...files.keys()]).toEqual(['/game/ship.config.ts'])
    expect([...files.values()].join('\n')).not.toMatch(/api_?key|credential|token/i)
  })

  it('says butler is missing, with a link to get it, and starts nothing', async () => {
    const { place, runs } = setup({ findButler: () => undefined })
    expect(await put(place)).toMatchObject({
      ok: false,
      need: 'butler',
      help: { label: 'Get itch.io’s uploader', href: 'https://itch.io/docs/butler/installing.html' },
    })
    expect(runs).toEqual([])
  })

  it('says to sign in when butler has no login, and starts nothing', async () => {
    const { place, runs } = setup({ signedIn: () => false })
    expect(await put(place)).toMatchObject({ ok: false, need: 'account' })
    expect(runs).toEqual([])
  })

  it('says the page needs making first when itch.io has none, with a link to make one', async () => {
    const { place } = setup({
      run: async () => ({ code: 1, output: 'itch.io API error: invalid target: game not found' }),
    })
    expect(await put(place)).toMatchObject({
      ok: false,
      need: 'project',
      help: { label: 'Make a page on itch.io', href: 'https://itch.io/game/new' },
    })
  })

  it('asks again for an address it cannot read, without touching butler or the config', async () => {
    const { place, runs, files } = setup()
    expect(await put(place, 'my game')).toMatchObject({ ok: false, need: 'project' })
    expect(runs).toEqual([])
    expect(files.get('/game/ship.config.ts')).toBe(CONFIG)
  })

  it('sends a refused login back to sign in', async () => {
    const { place } = setup({
      run: async () => ({ code: 1, output: 'Invalid API key: log in again with butler login' }),
    })
    expect(await put(place)).toMatchObject({ ok: false, need: 'account' })
  })

  it('says what butler printed when the push fails for another reason', async () => {
    const { place } = setup({ run: async () => ({ code: 1, output: 'network is unreachable' }) })
    expect(await put(place)).toMatchObject({ ok: false, need: 'push', detail: 'network is unreachable' })
  })

  it('signs in with butler login and says whether it worked', async () => {
    const { place, runs } = setup()
    expect(await place.signIn?.()).toEqual({ ok: true })
    expect(runs).toEqual([{ command: '/bin/butler', args: ['login'] }])
    const missing = setup({ findButler: () => undefined })
    expect(await missing.place.signIn?.()).toMatchObject({ ok: false })
  })

  it('works in a game whose ship.config.ts it can add the section to', async () => {
    const bare = CONFIG.replace("  itch: { project: 'your-itch-user/my-game', channel: 'html5' },\n", '')
    const { place, files } = setup({}, bare)
    await put(place)
    expect(files.get('/game/ship.config.ts')).toContain("project: 'your-name/my-game'")
  })
})
