// @vitest-environment jsdom
import type { DefinedGame } from '@automata/framework'
import { type RendererFactory, type RuntimeHandle, runGame } from '@automata/framework'
import {
  type FakeHostControl,
  fakeFetch,
  fakeHosting,
  type ManualFrames,
  manualFrames,
} from '@automata/framework/testing'
import type { StepResult } from '@automata/sim'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { emberwick } from '#src/app/game.ts'
import { GOLDEN_GOAL_TICK, GOLDEN_ROUTE } from '#src/testing/golden.ts'

// Emberwick's five screens on the real runtime (DX.3 step 5) in jsdom: AF's fake host (DIST spec §7), manual frames,
// and a renderer that keeps each step (Pixi needs WebGL, which jsdom lacks).

const STEP_MS = 1000 / 60

describe("Emberwick's screens", () => {
  let root: HTMLElement
  let frames: ManualFrames
  let results: StepResult[]
  let host: { readonly control: FakeHostControl; make: ReturnType<typeof fakeHosting>['make'] }
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
  /** The rounds the host received, as `{ kind, outcome? }`. */
  const rounds = () =>
    host.control.rounds.map((round) =>
      'start' in round
        ? { kind: 'start' }
        : round.end === undefined
          ? { kind: 'end' }
          : { kind: 'end', outcome: round.end },
    )
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

  const recording: RendererFactory = async () => ({
    ok: true,
    value: { apply: (result) => results.push(result), draw: () => {}, reset: () => {}, dispose: () => {} },
  })

  async function boot(): Promise<void> {
    const game: DefinedGame = emberwick
    handle = runGame({
      ...game,
      root,
      renderer: recording,
      seams: { frames, fetch: fakeFetch({}).fetch, hosting: host.make },
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
    host = fakeHosting()
  })
  afterEach(async () => {
    await handle?.shutdown()
    handle = undefined
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

  it('the Pause button pauses; Back to menu ends the round and goes to the menu; Play starts again at tick 0', async () => {
    await toRoom()
    step(3)
    button('Pause')?.click()
    await until(() => screen() === 'paused', 'paused')
    button('Back to menu')?.click()
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
