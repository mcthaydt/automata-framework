import type { DefinedGame } from '@mcthaydt/automata-game'
import {
  type GameRenderer,
  type RendererFactory,
  type RuntimeHandle,
  runGame,
} from '@mcthaydt/automata-runtime'
import { fakeFetch, type ManualFrames, manualFrames } from '@mcthaydt/automata-runtime/testing'
import type { StepResult } from '@mcthaydt/automata-sim'
import { createFakeHost, type FakeHost } from '@ruken/sdk-host/testing'
import { Effect } from 'effect'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { emberwick } from '../game.ts'
import { GOLDEN_GOAL_TICK, GOLDEN_ROUTE } from '../golden.ts'

// Emberwick's five screens on the real runtime (DX.3 step 5) in jsdom: the in-memory fake Ruken host, manual
// frames, and a renderer that keeps each step (Pixi needs WebGL, which jsdom lacks).

const STEP_MS = 1000 / 60

describe("Emberwick's screens", () => {
  let root: HTMLElement
  let frames: ManualFrames
  let results: StepResult[]
  let host: FakeHost
  let handle: RuntimeHandle | undefined

  const screen = () => root.dataset.screen
  const button = (name: string) =>
    [...root.querySelectorAll<HTMLButtonElement>('button')].find(
      (candidate) => (candidate.getAttribute('aria-label') ?? candidate.textContent?.trim()) === name,
    )
  const key = (type: 'keydown' | 'keyup', code: string) =>
    window.dispatchEvent(new KeyboardEvent(type, { code, key: code, bubbles: true, cancelable: true }))
  const step = (count = 1) => {
    for (let index = 0; index < count; index++) frames.advance(STEP_MS)
  }
  const rounds = () =>
    host.messages
      .filter((entry) => entry.dir === 'in' && entry.msg.type === 'telemetry.round')
      .map((entry) => entry.msg.payload)
  const playerX = () => {
    const rows = results.flatMap((result) => [...result.render.added, ...result.render.changed])
    return (rows.findLast((row) => row.components.player !== undefined)?.components.player as { x: number })
      ?.x
  }

  async function until(check: () => boolean, what: string): Promise<void> {
    for (let tries = 0; tries < 400; tries++) {
      if (check()) return
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
    throw new Error(`timed out waiting for ${what}`)
  }

  const recording: RendererFactory = () =>
    Effect.succeed<GameRenderer>({ apply: (result) => results.push(result), draw: () => {}, reset: () => {} })

  async function boot(): Promise<void> {
    const game: DefinedGame = emberwick
    handle = runGame({
      ...game,
      root,
      renderer: recording,
      seams: { frames, fetch: fakeFetch({}).fetch, sdkEnv: () => host.gameEnv as never },
    })
    await until(() => frames.pending, 'the first frame')
    step()
    await until(() => screen() === 'splash', 'the splash')
  }

  async function toRoom(): Promise<void> {
    await boot()
    key('keydown', 'KeyX')
    await until(() => screen() === 'menu', 'the menu')
    button('Play')?.click()
    await until(() => screen() === 'room', 'the room')
  }

  beforeEach(() => {
    root = document.body.appendChild(document.createElement('main'))
    root.id = 'game'
    frames = manualFrames()
    results = []
    host = createFakeHost({
      gameOrigin: window.location.origin,
      gameId: emberwick.id,
      clock: {
        epochMs: () => Date.now(),
        setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
        clearTimeout: (timer: unknown) => clearTimeout(timer as number),
      },
    })
  })
  afterEach(async () => {
    await handle?.shutdown()
    handle = undefined
    host.dispose()
    root.remove()
    document.documentElement.removeAttribute('data-state')
  })

  it('shows the splash, then the menu on any key, with Play (primary) focused', async () => {
    await boot()
    expect(document.documentElement.dataset.state).toBe('ready')
    key('keydown', 'KeyX')
    await until(() => screen() === 'menu', 'the menu')
    expect(button('Play')?.dataset.kind).toBe('primary')
    expect(document.activeElement).toBe(button('Play'))
  })

  it('moves on from the splash by itself', async () => {
    await boot()
    await new Promise((resolve) => setTimeout(resolve, 1600))
    await until(() => screen() === 'menu', 'the menu')
  })

  it('Play starts a round on a fresh sim and steps move commands from the keys held', async () => {
    await toRoom()
    expect(rounds()).toEqual([{ kind: 'start' }])
    step()
    expect(results[0]?.tick).toBe(1)
    expect(results[0]?.render.resync).toBe(true)
    const x0 = playerX()
    key('keydown', 'ArrowRight')
    step(10)
    expect(playerX()).toBeGreaterThan(x0)
    expect(results.flatMap((result) => result.rejected)).toEqual([])
  })

  it.each(['Escape', 'KeyP'])('%s pauses: the sim stops; Escape resumes on the same tick', async (code) => {
    await toRoom()
    step(3)
    key('keydown', code)
    await until(() => screen() === 'paused', 'paused')
    expect(document.activeElement).toBe(button('Resume'))
    const applied = results.length
    step(5)
    expect(results.length).toBe(applied)
    key('keydown', 'Escape')
    await until(() => screen() === 'room', 'the room again')
    step()
    expect(results.at(-1)?.tick).toBe(4)
  })

  it('the Pause button pauses; Quit ends the round and goes to the menu; Play starts again at tick 0', async () => {
    await toRoom()
    step(3)
    button('Pause')?.click()
    await until(() => screen() === 'paused', 'paused')
    button('Quit')?.click()
    await until(() => screen() === 'menu', 'the menu')
    expect(rounds()).toEqual([{ kind: 'start' }, { kind: 'end', outcome: 'quit' }])
    results.length = 0
    button('Play')?.click()
    await until(() => screen() === 'room', 'the room')
    step()
    expect(results[0]?.tick).toBe(1)
  })

  it("the host's menu request pauses the room", async () => {
    await toRoom()
    expect(emberwick.screens.find((candidate) => candidate.id === 'room')?.openMenu?.()).toBe(true)
    await until(() => screen() === 'paused', 'paused')
  })

  it('the golden route reaches the ember: the end screen shows the time and the round completes', async () => {
    await toRoom()
    const keysFor = (x: number, jump: boolean) => [
      ...(x === -1 ? ['ArrowLeft'] : x === 1 ? ['ArrowRight'] : []),
      ...(jump ? ['KeyZ'] : []),
    ]
    let held: string[] = []
    let ticks = 0
    for (const [x, jump, length] of GOLDEN_ROUTE) {
      const wanted = keysFor(x, jump)
      for (const code of held) if (!wanted.includes(code)) key('keyup', code)
      for (const code of wanted) if (!held.includes(code)) key('keydown', code)
      held = wanted
      ticks = Math.min(ticks + length, GOLDEN_GOAL_TICK)
      while ((results.at(-1)?.tick ?? 0) < ticks) step()
      if (ticks === GOLDEN_GOAL_TICK) break
    }
    for (const code of held) key('keyup', code)
    await until(() => screen() === 'end', 'the end screen')
    expect(root.querySelector('[data-slot="time"]')?.textContent).toBe('5.70 s')
    expect(document.activeElement).toBe(button('Play again'))
    expect(rounds()).toEqual([{ kind: 'start' }, { kind: 'end', outcome: 'complete' }])

    results.length = 0
    button('Play again')?.click()
    await until(() => screen() === 'room', 'the room')
    step()
    expect(results[0]?.tick).toBe(1)
  })
})
