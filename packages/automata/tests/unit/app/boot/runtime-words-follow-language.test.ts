import { flushSync } from 'svelte'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { contentHashOf } from '#src/app/boot/boot-program.ts'
import type { CompiledContentData, GameDefinition } from '#src/app/boot/game-definition.ts'
import { runGame } from '#src/app/boot/run-game.ts'
import type { RuntimeServices } from '#src/app/flow/screen.ts'
import ja from '#src/app/screens/words/ja.json' with { type: 'json' }
import ko from '#src/app/screens/words/ko.json' with { type: 'json' }
import { ok } from '#src/shared/lib/result.ts'
import type { RenderTarget } from '#src/shared/runtime/render/renderer.ts'
import { fakeHosting } from '#src/testing/host/fake-hosting.ts'
import { fakeFetch } from '#src/testing/runtime/fake-fetch.ts'
import { type ManualFrames, manualFrames } from '#src/testing/runtime/manual-frames.ts'
import { nullGameRenderer } from '#src/testing/runtime/null-renderer.ts'

// The runtime's own words follow the language in force: the saved choice, then the host's, then the browser's guess, and
// a change in Settings changes them too. These panels used to keep the words chosen at boot from the browser alone.

const data: CompiledContentData = {
  flow: {
    entry: 'title',
    screens: ['title', 'room'],
    terminal: [],
    transitions: [{ from: 'title', event: 'next', to: 'room', transition: 'cut' }],
  },
  game: {
    source_language: 'en',
    rating: 'everyone',
    descriptors: [],
    custom_events: [],
    preload_screens: ['title'],
  },
}

const settle = async (rounds: number): Promise<void> => {
  for (let round = 0; round < rounds; round++) await new Promise<void>((resolve) => setTimeout(resolve, 0))
}

let root: HTMLElement
beforeEach(() => {
  root = document.createElement('div')
  document.body.appendChild(root)
})
afterEach(() => {
  root.remove()
  for (const name of ['data-state', 'lang', 'dir']) document.documentElement.removeAttribute(name)
})

interface Booted {
  readonly services: RuntimeServices
  readonly reportLost: NonNullable<RenderTarget['reportLost']>
  readonly shutdown: () => Promise<void>
}

/** Boots a three-language game on a browser that speaks English; `saves` is what the host already holds. */
async function boot(options: {
  saves?: Record<string, string>
  copy?: GameDefinition['copy']
  /** Makes the second screen's files a 404, so a transition to it fails to load. */
  missingFile?: boolean
}): Promise<Booted> {
  const frames: ManualFrames = manualFrames()
  const contentData: CompiledContentData =
    options.missingFile === true
      ? { ...data, assets: { screens: { room: { files: ['/missing.bin'] } } } }
      : data
  const host = fakeHosting({ ...(options.saves === undefined ? {} : { saves: options.saves }) })
  let services: RuntimeServices | undefined
  let reportLost: RenderTarget['reportLost'] | undefined
  const game: GameDefinition = {
    root,
    hosting: { gameId: 'words-test', wants: [], pauseBehavior: 'pause' },
    content: { data: contentData, hash: contentHashOf(contentData) },
    locale: { locales: ['en', 'ja', 'ko'], baseLocale: 'en' },
    ...(options.copy === undefined ? {} : { copy: options.copy }),
    screens: [
      {
        id: 'title',
        enter: (context) => {
          services = context.services
        },
      },
      { id: 'room', enter: () => {} },
    ],
    renderer: async (target) => {
      reportLost = target.reportLost
      return ok(nullGameRenderer())
    },
    seams: {
      frames,
      fetch: fakeFetch({ '/missing.bin': { status: 404 } }).fetch,
      languages: ['en'],
      hosting: (hostingOptions, seams) => host.make(hostingOptions, seams),
    },
  } as GameDefinition
  const handle = runGame(game)
  for (let count = 0; count < 200 && services === undefined; count++) {
    if (frames.pending) frames.advance(16)
    await settle(2)
  }
  flushSync()
  if (services === undefined || reportLost === undefined) throw new Error('the game did not boot')
  return {
    services,
    reportLost: reportLost as NonNullable<RenderTarget['reportLost']>,
    shutdown: () => handle.shutdown(),
  }
}

const alertText = (): string => root.querySelector('[role="alert"]')?.textContent ?? ''

describe('the lost-picture panel', () => {
  it('speaks the saved choice, not the browser’s guess', async () => {
    const booted = await boot({ saves: { 'automata.locale': 'ja' } })
    booted.reportLost(() => {})
    expect(alertText()).toContain(ja.runtime_context_lost)
    expect(alertText()).toContain(ja.runtime_retry)
    await booted.shutdown()
  })

  it('speaks the language chosen after boot, when it is shown', async () => {
    const booted = await boot({})
    booted.services.locale.set('ko')
    booted.reportLost(() => {})
    expect(alertText()).toContain(ko.runtime_context_lost)
    await booted.shutdown()
  })

  it('takes the game’s own words as a function of the language', async () => {
    const booted = await boot({
      copy: (locale: string) => ({ contextLost: `lost in ${locale}` }),
    })
    booted.services.locale.set('ja')
    booted.reportLost(() => {})
    expect(alertText()).toContain('lost in ja')
    await booted.shutdown()
  })
})

describe('the flow’s words', () => {
  it('follow a language change: a download that fails says so in the language in force', async () => {
    const booted = await boot({ missingFile: true })
    booted.services.locale.set('ja')
    booted.services.flow.dispatch('next')
    await booted.services.flow.settled()
    expect(alertText()).toContain(ja.runtime_download)
    await booted.shutdown()
  })
})
