import { createFakeHost, settle } from '@ruken/sdk-host/testing'
import { flushSync } from 'svelte'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { contentHashOf } from '#src/app/boot/boot-program.ts'
import type { CompiledContentData, GameDefinition } from '#src/app/boot/game-definition.ts'
import { runGame } from '#src/app/boot/run-game.ts'
import { createT } from '#src/features/locale/paraglide.ts'
import { loadParaglideFixture, type ParaglideFixture } from '#src/features/locale/testing/load-fixture.ts'
import { fakeFetch } from '#src/testing/runtime/fake-fetch.ts'
import { type ManualFrames, manualFrames } from '#src/testing/runtime/manual-frames.ts'
import { nullRenderer } from '#src/testing/runtime/null-renderer.ts'
import { realClock } from '../../../../../src/testing/host/page/clocks.ts'
import { TEST_GAME_ORIGIN } from '../../../../../src/testing/host/page/ruken/hosting-test.ts'

// PRODUCT spec §4, acceptance L-b and L-c at the runtime level: booted under the fake Ruken host.

type FakeGameEnv = NonNullable<ReturnType<typeof createFakeHost>['gameEnv']>

/**
 * The fake host always welcomes with `en-US`, and has no option for another locale yet (a Ruken request,
 * recorded in 02). Until then this rewrites the welcome's `locale` on its way into the SDK, as the host
 * package's own tests wrap `onWindowMessage`; everything else about the welcome stays the fake host's.
 */
function withWelcomeLocale(env: FakeGameEnv, locale: string): FakeGameEnv {
  return {
    ...env,
    onWindowMessage: (listener) =>
      env.onWindowMessage((event) => {
        const data = event.data as { type?: unknown; payload?: Record<string, unknown> } | null
        if (data?.type !== 'welcome' || data.payload === undefined) return listener(event)
        listener({ ...event, data: { ...data, payload: { ...data.payload, locale } } })
      }),
  }
}

function content(sourceLanguage = 'en'): CompiledContentData {
  return {
    flow: { entry: 'title', screens: ['title'], terminal: [], transitions: [] },
    game: {
      source_language: sourceLanguage,
      rating: 'everyone',
      descriptors: [],
      custom_events: [],
      preload_screens: ['title'],
    },
  }
}

async function bootUntilReady(frames: ManualFrames): Promise<void> {
  for (
    let count = 0;
    count < 200 && document.documentElement.getAttribute('data-state') !== 'ready';
    count++
  ) {
    if (frames.pending) frames.advance(16)
    await settle(2)
  }
  flushSync()
  expect(document.documentElement.getAttribute('data-state')).toBe('ready')
}

let fixture: ParaglideFixture
let root: HTMLElement

beforeAll(async () => {
  fixture = await loadParaglideFixture()
})

beforeEach(() => {
  root = document.createElement('div')
  document.body.appendChild(root)
  return () => {
    root.remove()
    for (const name of ['data-state', 'lang', 'dir']) document.documentElement.removeAttribute(name)
  }
})

function game(options: {
  readonly welcomeLocale?: string
  readonly hostSaves?: Record<string, string>
  readonly locale?: GameDefinition['locale']
  readonly languages?: readonly string[]
  readonly content?: CompiledContentData
  readonly screen: GameDefinition['screens'][number]['enter']
  readonly frames: ManualFrames
}): GameDefinition {
  const data = options.content ?? content()
  return {
    root,
    hosting: { gameId: 'test-game', wants: ['saves'], pauseBehavior: 'pause' },
    content: { data, hash: contentHashOf(data) },
    screens: [{ id: 'title', enter: options.screen }],
    renderer: nullRenderer(),
    ...(options.locale !== undefined ? { locale: options.locale } : {}),
    seams: {
      frames: options.frames,
      fetch: fakeFetch({}).fetch,
      languages: options.languages ?? [],
      sdkEnv: () => {
        const host = createFakeHost({
          gameOrigin: TEST_GAME_ORIGIN,
          gameId: 'test-game',
          clock: realClock,
          autoReady: true,
          ...(options.hostSaves !== undefined ? { saves: options.hostSaves } : {}),
        })
        // biome-ignore lint/style/noNonNullAssertion: in-memory mode always has a game env.
        const env = host.gameEnv!
        return options.welcomeLocale === undefined ? env : withWelcomeLocale(env, options.welcomeLocale)
      },
    },
  }
}

describe('runGame locale (PRODUCT spec §4)', () => {
  it("L-b: a session locale of fr gives French on the first screen, and <html lang='fr'>, with no English first", async () => {
    const frames = manualFrames()
    const t = createT(fixture.messages)
    const seen: string[] = []
    const handle = runGame(
      game({
        frames,
        welcomeLocale: 'fr',
        locale: fixture.runtime,
        screen: () => {
          seen.push(`${document.documentElement.lang}:${t('play')}`)
        },
      }),
    )
    await bootUntilReady(frames)
    expect(seen).toEqual(['fr:Jouer'])
    expect(document.documentElement.dir).toBe('ltr')
    await handle.shutdown()
  })

  it("uses the content's source language when the game declares no locales", async () => {
    const frames = manualFrames()
    let current: string | undefined
    const handle = runGame(
      game({
        frames,
        content: content('fr'),
        screen: ({ services }) => {
          current = services.locale.current
        },
      }),
    )
    await bootUntilReady(frames)
    expect(current).toBe('fr')
    expect(document.documentElement.lang).toBe('fr')
    await handle.shutdown()
  })

  it("takes the saved choice over the browser's languages when the session locale is not offered", async () => {
    const frames = manualFrames()
    let current: string | undefined
    const handle = runGame(
      game({
        frames,
        welcomeLocale: 'ja',
        hostSaves: { 'automata.locale': 'fr' },
        languages: ['en-GB'],
        locale: fixture.runtime,
        screen: ({ services }) => {
          current = services.locale.current
        },
      }),
    )
    await bootUntilReady(frames)
    expect(current).toBe('fr')
    await handle.shutdown()
  })

  it('L-c: switching language mid-screen keeps the screen and its focused element, and enters no screen', async () => {
    const frames = manualFrames()
    const t = createT(fixture.messages)
    let switchTo: ((locale: string) => void) | undefined
    let flowCurrent: (() => string | undefined) | undefined
    const entered: string[] = []
    let button: HTMLButtonElement | undefined
    const handle = runGame(
      game({
        frames,
        welcomeLocale: 'fr',
        locale: fixture.runtime,
        screen: (context) => {
          const { locale, flow, bus } = context.services
          const element = document.createElement('button')
          element.textContent = t('play')
          context.layer.appendChild(element)
          element.focus()
          button = element
          bus.subscribe('locale.changed', () => {
            element.textContent = t('play')
          })
          // Listening starts after this screen's own 'screen.entered', so only a later entry is heard.
          switchTo = (next) => {
            bus.subscribe('screen.entered', (fact) => entered.push(fact.screen))
            locale.set(next)
          }
          flowCurrent = () => flow.current
        },
      }),
    )
    await bootUntilReady(frames)
    expect(button?.textContent).toBe('Jouer')
    expect(document.activeElement).toBe(button)

    switchTo?.('en')
    await settle(5)

    expect(button?.textContent).toBe('Play')
    expect(button?.isConnected).toBe(true)
    expect(document.activeElement).toBe(button)
    expect(flowCurrent?.()).toBe('title')
    expect(entered).toEqual([])
    expect(document.documentElement.lang).toBe('en')
    await handle.shutdown()
  })
})
