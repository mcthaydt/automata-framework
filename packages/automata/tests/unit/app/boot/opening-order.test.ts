import { settle } from '@ruken/sdk-host/testing'
import { flushSync } from 'svelte'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { contentHashOf } from '#src/app/boot/boot-program.ts'
import type { CompiledContentData, GameDefinition } from '#src/app/boot/game-definition.ts'
import { runGame } from '#src/app/boot/run-game.ts'
import type { RuntimeServices } from '#src/app/flow/screen.ts'
import type { OpeningStep } from '#src/app/opening/opening.ts'
import { fakeHosting } from '#src/testing/host/fake-hosting.ts'
import { fakeFetch } from '#src/testing/runtime/fake-fetch.ts'
import { type ManualFrames, manualFrames } from '#src/testing/runtime/manual-frames.ts'
import { nullRenderer } from '#src/testing/runtime/null-renderer.ts'

// Where the opening sits in a boot: after the host's ready, before the first screen, with the sim held and the host's
// "Open game menu" doing nothing yet because there is no menu to open.

const data: CompiledContentData = {
  flow: { entry: 'title', screens: ['title'], terminal: [], transitions: [] },
  game: {
    source_language: 'en',
    rating: 'everyone',
    descriptors: [],
    custom_events: [],
    preload_screens: ['title'],
  },
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

async function untilScreen(frames: ManualFrames, entered: string[]): Promise<void> {
  for (let count = 0; count < 200 && entered.length === 0; count++) {
    if (frames.pending) frames.advance(16)
    await settle(2)
  }
  flushSync()
}

function game(options: {
  readonly opening?: readonly OpeningStep[]
  readonly entered: string[]
  readonly frames: ManualFrames
  readonly host?: ReturnType<typeof fakeHosting>
}): GameDefinition {
  const host = options.host ?? fakeHosting()
  return {
    root,
    hosting: { gameId: 'opening-test', wants: [], pauseBehavior: 'pause' },
    content: { data, hash: contentHashOf(data) },
    screens: [{ id: 'title', enter: () => void options.entered.push('screen:title') }],
    renderer: nullRenderer(),
    ...(options.opening === undefined ? {} : { opening: options.opening }),
    seams: {
      frames: options.frames,
      fetch: fakeFetch({}).fetch,
      languages: [],
      hosting: (hostingOptions, seams) => host.make(hostingOptions, seams),
    },
  }
}

describe('the opening in a boot', () => {
  it('runs after hosting.ready and before the first screen enters', async () => {
    const frames = manualFrames()
    const order: string[] = []
    const handle = runGame(
      game({
        frames,
        entered: order,
        opening: [
          async ({ layer }) => {
            order.push(`opening:${document.documentElement.getAttribute('data-state')}:${layer.isConnected}`)
          },
        ],
      }),
    )
    for (let count = 0; count < 200 && !order.includes('screen:title'); count++) {
      if (frames.pending) frames.advance(16)
      await settle(2)
    }
    expect(order).toEqual(['opening:ready:true', 'screen:title'])
    await handle.shutdown()
  })

  it('holds the sim while the opening runs and lets it go after', async () => {
    const frames = manualFrames()
    const order: string[] = []
    let release: (() => void) | undefined
    const seen: string[] = []
    const handle = runGame(
      game({
        frames,
        entered: order,
        opening: [
          ({ services }) =>
            new Promise<void>((resolve) => {
              // The runtime hands a step its whole services object; the type narrows it to what a step may use.
              const { time } = services as unknown as Pick<RuntimeServices, 'time'>
              seen.push(`during:${[...time.reasons].join(',')}`)
              release = resolve
            }),
        ],
      }),
    )
    for (let count = 0; count < 200 && release === undefined; count++) {
      if (frames.pending) frames.advance(16)
      await settle(2)
    }
    expect(seen).toEqual(['during:opening'])
    expect(order).toEqual([])
    release?.()
    for (let count = 0; count < 200 && !order.includes('screen:title'); count++) {
      if (frames.pending) frames.advance(16)
      await settle(2)
    }
    expect(order).toEqual(['screen:title'])
    await handle.shutdown()
  })

  it('boots exactly as before for a game with no opening', async () => {
    const frames = manualFrames()
    const order: string[] = []
    const handle = runGame(game({ frames, entered: order }))
    await untilScreen(frames, order)
    expect(order).toEqual(['screen:title'])
    expect(document.documentElement.getAttribute('data-state')).toBe('ready')
    await handle.shutdown()
  })

  it('does nothing for the host’s menu request until the first screen has entered', async () => {
    const frames = manualFrames()
    const order: string[] = []
    const host = fakeHosting()
    let release: (() => void) | undefined
    const answers: boolean[] = []
    const handle = runGame(
      game({
        frames,
        entered: order,
        host,
        opening: [
          () =>
            new Promise<void>((resolve) => {
              answers.push(host.control.requestMenu())
              release = resolve
            }),
        ],
      }),
    )
    for (let count = 0; count < 200 && release === undefined; count++) {
      if (frames.pending) frames.advance(16)
      await settle(2)
    }
    release?.()
    await untilScreen(frames, order)
    expect(answers).toEqual([false])
    await handle.shutdown()
  })
})
