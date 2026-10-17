import {
  type GameRenderer,
  type RendererFactory,
  type RuntimeHandle,
  runGame,
} from '@mcthaydt/automata-runtime'
import { fakeFetch, type ManualFrames, manualFrames } from '@mcthaydt/automata-runtime/testing'
import {
  defineCommand,
  defineComponent,
  definePlugin,
  defineSystem,
  type Sim,
  type StepResult,
} from '@mcthaydt/automata-sim'
import { Effect } from 'effect'
import { flushSync } from 'svelte'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { type DefinedGame, defineGame, type GameSpec } from '../define-game.ts'
import { keys } from '../input/keys.ts'
import { defaultScreens } from './default-screens.ts'

// The default title, play and paused screens (DX spec §7), booted by the real runtime in jsdom: standalone
// hosting, manual frames and a renderer that records what it is given (Pixi needs WebGL, which jsdom lacks).
const Body = defineComponent('body', { x: 'f32' })
const Move = defineCommand('move', z.object({ x: z.number().int().min(-1).max(1).default(0) }))
const move = defineSystem('move', (ctx) => {
  for (const { payload } of ctx.commands.of(Move))
    for (const body of ctx.query(Body)) body.set(Body, { x: body.get(Body).x + payload.x })
})
const square = definePlugin({ name: 'square', defs: [Body, Move, move] })

const tick = async () => {
  await new Promise((resolve) => setTimeout(resolve, 0))
  flushSync()
}
async function until(check: () => boolean, what: string): Promise<void> {
  for (let tries = 0; tries < 400; tries++) {
    if (check()) return
    await tick()
  }
  throw new Error(`timed out waiting for ${what}`)
}

/** A renderer that keeps every step result it is given. */
function recordingRenderer(results: StepResult[], resets: { count: number }): RendererFactory {
  const renderer: GameRenderer = {
    apply: (result) => results.push(result),
    draw: () => {},
    reset: () => {
      resets.count++
    },
  }
  return () => Effect.succeed(renderer)
}

describe('default screens', () => {
  let root: HTMLElement
  let frames: ManualFrames
  let results: StepResult[]
  let resets: { count: number }
  let handle: RuntimeHandle | undefined
  let game: DefinedGame

  const screen = (id: string) => root.querySelector(`[data-testid="${id}-screen"]`)
  const button = (testId: string) => root.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`)
  const press = (code: string, target: EventTarget = window) =>
    target.dispatchEvent(new KeyboardEvent('keydown', { code, key: code, bubbles: true, cancelable: true }))
  const step = (count = 1) => {
    for (let index = 0; index < count; index++) frames.advance(1000 / 60)
  }
  const lastX = () => {
    const rows = results.flatMap((result) => [...result.render.added, ...result.render.changed])
    return (rows.at(-1)?.components.body as { x: number } | undefined)?.x
  }

  async function boot(spec: Partial<GameSpec> = {}, withInput = true): Promise<void> {
    const base: GameSpec = {
      id: 'screens-test',
      title: 'Square',
      size: { width: 320, height: 180 },
      sim: { plugins: [square], seed: 3, setup: (sim) => void sim.spawn([[Body, { x: 10 }]]) },
      root,
      seams: { frames, fetch: fakeFetch({}).fetch },
    }
    const input = keys(Move, { ArrowLeft: { x: -1 }, ArrowRight: { x: 1 } })
    game = defineGame({ ...base, ...(withInput ? { input } : {}), ...spec })
    handle = runGame({ ...game, root, renderer: recordingRenderer(results, resets) })
    await until(() => frames.pending, 'the first frame')
    step()
    await until(() => document.documentElement.getAttribute('data-state') === 'ready', 'ready')
    await until(() => screen('title') !== null, 'the title screen')
  }

  async function toPlay(): Promise<void> {
    button('play')?.click()
    await until(() => screen('play') !== null, 'the play screen')
  }

  beforeEach(() => {
    root = document.body.appendChild(document.createElement('main'))
    frames = manualFrames()
    results = []
    resets = { count: 0 }
  })
  afterEach(async () => {
    await handle?.shutdown()
    handle = undefined
    root.remove()
    document.documentElement.removeAttribute('data-state')
  })

  it('title shows the game’s title and a primary Play that has focus', async () => {
    await boot()
    expect(screen('title')?.textContent).toContain('Square')
    expect(button('play')?.dataset.kind).toBe('primary')
    expect(document.activeElement).toBe(button('play'))
  })

  it.each(['Enter', 'Space'])('%s on the title goes to play', async (code) => {
    await boot()
    ;(document.activeElement as HTMLElement | null)?.blur()
    press(code)
    await until(() => screen('play') !== null, 'the play screen')
  })

  it('play creates the sim with the seed and setup, and steps the input map’s commands', async () => {
    await boot()
    await toPlay()
    step()
    expect(results[0]?.render.resync).toBe(true)
    expect(lastX()).toBe(10)
    press('ArrowRight')
    step(3)
    expect(lastX()).toBe(13)
  })

  it.each(['Escape', 'KeyP'])('%s in play pauses: the sim stops', async (code) => {
    await boot()
    await toPlay()
    step(2)
    press(code)
    await until(() => screen('paused') !== null, 'the paused screen')
    const applied = results.length
    step(5)
    expect(results.length).toBe(applied)
  })

  it('the corner Pause button pauses too', async () => {
    await boot()
    await toPlay()
    button('pause')?.click()
    await until(() => screen('paused') !== null, 'the paused screen')
  })

  it('the host’s menu request opens paused', async () => {
    await boot()
    await toPlay()
    expect(game.screens.find((candidate) => candidate.id === 'play')?.openMenu?.()).toBe(true)
    await until(() => screen('paused') !== null, 'the paused screen')
  })

  it('Resume (focused) and Escape return to the same sim, re-sent in full to the renderer', async () => {
    await boot()
    await toPlay()
    press('ArrowRight')
    step(4)
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowRight' }))
    const tickBefore = results.at(-1)?.tick ?? -1
    press('Escape')
    await until(() => screen('paused') !== null, 'the paused screen')
    expect(document.activeElement).toBe(button('resume'))
    button('resume')?.click()
    await until(() => screen('play') !== null, 'the play screen again')
    step()
    expect(results.at(-1)?.tick).toBe(tickBefore + 1)
    expect(results.at(-1)?.render.resync).toBe(true)
    expect(lastX()).toBe(14)

    press('Escape')
    await until(() => screen('paused') !== null, 'paused again')
    press('Escape')
    await until(() => screen('play') !== null, 'play after Escape')
  })

  it('Quit to title drops the sim: the next Play starts again at tick 0', async () => {
    await boot()
    await toPlay()
    step(3)
    press('Escape')
    await until(() => screen('paused') !== null, 'the paused screen')
    button('quit')?.click()
    await until(() => screen('title') !== null, 'the title screen')
    results.length = 0
    await toPlay()
    step()
    expect(results[0]?.tick).toBe(1)
    expect(lastX()).toBe(10)
  })

  it('shows touch buttons only when the player uses touch', async () => {
    await boot()
    await toPlay()
    expect(root.querySelector('[data-testid="move-0"]')).toBeNull()
    window.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch' }))
    await until(() => root.querySelector('[data-testid="move-0"]') !== null, 'the touch buttons')
    const right = button('move-1') as HTMLButtonElement
    expect(right.textContent).toBe('→')
    right.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }))
    step(2)
    expect(lastX()).toBe(12)
    right.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
    step()
    expect(lastX()).toBe(12)
  })

  it('shows no touch buttons when the input map says touch: false', async () => {
    await boot({ input: keys(Move, { ArrowLeft: { x: -1 } }, { touch: false }) })
    await toPlay()
    window.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch' }))
    await tick()
    expect(root.querySelector('[data-testid="move-0"]')).toBeNull()
  })

  it('plays with no input map, sending no commands', async () => {
    await boot({}, false)
    await toPlay()
    step(2)
    expect(results.flatMap((result) => result.rejected)).toEqual([])
    expect(lastX()).toBe(10)
  })

  it('hands the play screen’s sim to watchSim, and undefined when the title drops it (the draw layer)', async () => {
    const watched: (Sim | undefined)[] = []
    const sim = { plugins: [square], seed: 3, setup: (live: Sim) => void live.spawn([[Body, { x: 10 }]]) }
    await boot(
      { screens: defaultScreens({ title: 'Square', sim, watchSim: (live) => watched.push(live) }) },
      false,
    )
    expect(watched).toEqual([undefined])
    await toPlay()
    expect(watched.at(-1)?.tick).toBe(0)
    const live = watched.at(-1)
    press('Escape')
    await until(() => screen('paused') !== null, 'the paused screen')
    button('resume')?.click()
    await until(() => screen('play') !== null, 'the play screen again')
    expect(watched.at(-1)).toBe(live)
    press('Escape')
    await until(() => screen('paused') !== null, 'paused again')
    button('quit')?.click()
    await until(() => screen('title') !== null, 'the title screen')
    expect(watched.at(-1)).toBeUndefined()
  })
})
