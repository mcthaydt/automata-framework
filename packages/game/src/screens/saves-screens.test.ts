import { realClock, TEST_GAME_ORIGIN } from '@mcthaydt/automata-host/testing'
import {
  defineSave,
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
import { createFakeHost, settle } from '@ruken/sdk-host/testing'
import { Effect } from 'effect'
import { flushSync } from 'svelte'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { type DefinedGame, defineGame, type GameSaves, type GameSpec } from '../define-game.ts'
import { keys } from '../input/keys.ts'

// The default screens of a game with a save (M5.2, M5 spec §5, §7): the title lists the slots in place of Play, New
// game and Continue start play, play keeps the slot saved, and a second session on the same server lists what the
// first one wrote (S-c). Booted by the real runtime in jsdom under the fake Ruken host, which holds the "server".
const Body = defineComponent('body', { x: 'f32' })
const Move = defineCommand('move', z.object({ x: z.number().int().min(-1).max(1).default(0) }))
const move = defineSystem('move', (ctx) => {
  for (const { payload } of ctx.commands.of(Move))
    for (const body of ctx.query(Body)) body.set(Body, { x: body.get(Body).x + payload.x })
})
const square = definePlugin({ name: 'square', defs: [Body, Move, move] })

const RunData = z.object({ x: z.number() })
const runSave = defineSave({
  key: 'run',
  version: 1,
  schema: RunData,
  empty: () => ({ x: 0 }),
  migrations: {},
  slots: { count: 3 },
})
const saves: GameSaves<{ x: number }> = {
  def: runSave,
  capture: (sim: Sim) => ({ x: sim.query(Body)[0]?.get(Body).x ?? 0 }),
  apply: (sim: Sim, data: { x: number }) => {
    sim.query(Body)[0]?.set(Body, { x: data.x })
  },
  label: (slot: number) => `Run ${slot + 1}`,
}

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

function recordingRenderer(results: StepResult[]): RendererFactory {
  const renderer: GameRenderer = { apply: (result) => results.push(result), draw: () => {}, reset: () => {} }
  return () => Effect.succeed(renderer)
}

/** What the fake host's server holds for a slot's key, parsed, or undefined. */
const stored = (server: ReturnType<typeof createFakeHost>['fakes']['server'], slot: number) => {
  const raw = server.slots.get(`run.slot.${slot}`)?.value
  return raw === undefined ? undefined : (JSON.parse(raw) as { label?: string; data: { x: number } })
}

describe('default screens with a save (M5.2)', () => {
  let root: HTMLElement
  let frames: ManualFrames
  let results: StepResult[]
  let handle: RuntimeHandle | undefined
  let host: ReturnType<typeof createFakeHost> | undefined
  const sims: Sim[] = []

  const screen = (id: string) => root.querySelector(`[data-testid="${id}-screen"]`)
  const button = (testId: string) => root.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`)
  const row = (slot: number) => root.querySelector<HTMLElement>(`[data-save-slot="${slot}"]`)
  const press = (code: string) =>
    window.dispatchEvent(new KeyboardEvent('keydown', { code, key: code, bubbles: true, cancelable: true }))
  const step = (count = 1) => {
    for (let index = 0; index < count; index++) frames.advance(1000 / 60)
  }
  const lastX = () => {
    const rows = results.flatMap((result) => [...result.render.added, ...result.render.changed])
    return (rows.at(-1)?.components.body as { x: number } | undefined)?.x
  }

  /** Boots the game under a fresh fake host holding `seed`, to its title; `withSaves` false is a game without a save. */
  async function boot(
    spec: Partial<GameSpec> = {},
    seed: Record<string, string> = {},
    withSaves = true,
  ): Promise<DefinedGame> {
    frames = manualFrames()
    results = []
    const game = defineGame({
      id: 'saves-screens',
      title: 'Square',
      size: { width: 320, height: 180 },
      sim: {
        plugins: [square],
        seed: 3,
        setup: (sim) => {
          sims.push(sim)
          sim.spawn([[Body, { x: 10 }]])
        },
      },
      input: keys(Move, { ArrowLeft: { x: -1 }, ArrowRight: { x: 1 } }),
      root,
      ...(withSaves ? { saves } : {}),
      seams: {
        frames,
        fetch: fakeFetch({}).fetch,
        sdkEnv: () => {
          host = createFakeHost({
            gameOrigin: TEST_GAME_ORIGIN,
            gameId: 'saves-screens',
            clock: realClock,
            saves: seed,
          })
          if (host.gameEnv === undefined || host.gameEnv === null)
            throw new Error('the fake host has no game environment')
          return host.gameEnv
        },
      },
      ...spec,
    })
    handle = runGame({ ...game, root, renderer: recordingRenderer(results) })
    await until(() => frames.pending, 'the first frame')
    step()
    await until(() => document.documentElement.getAttribute('data-state') === 'ready', 'ready')
    await until(() => screen('title') !== null, 'the title screen')
    return game
  }

  /** The host closes the game (Ruken's `session.exiting`): the exit flush runs, and the server has what was written. */
  async function close(): Promise<void> {
    await host?.bridge.exit()
    await handle?.shutdown()
    handle = undefined
    await settle(4)
  }

  beforeEach(() => {
    root = document.body.appendChild(document.createElement('main'))
  })
  afterEach(async () => {
    await handle?.shutdown()
    handle = undefined
    for (const sim of sims.splice(0)) sim.dispose()
    root.remove()
    document.documentElement.removeAttribute('data-state')
  })

  it('keeps Play on the title of a game without a save, and lists no slots', async () => {
    await boot({}, {}, false)
    expect(button('play')).not.toBeNull()
    expect(root.querySelector('[data-save-slots]')).toBeNull()
  })

  it('lists the save’s slots on the title in place of Play, every one empty at first', async () => {
    await boot()
    expect(button('play')).toBeNull()
    expect(root.querySelector('[data-save-slots]')?.getAttribute('data-state')).toBe('slots')
    expect([...root.querySelectorAll('[data-save-slot]')].map((r) => r.getAttribute('data-kind'))).toEqual([
      'empty',
      'empty',
      'empty',
    ])
    expect(row(0)?.textContent).toContain('Slot 1')
    // The chosen slot’s action is the title’s primary, and has focus.
    expect(button('save-slots-new')?.dataset.kind).toBe('primary')
    await until(() => document.activeElement === button('save-slots-new'), 'focus on New game')
  })

  it('New game writes the starting data to the chosen slot with its label, and plays', async () => {
    await boot()
    row(1)?.click()
    flushSync()
    button('save-slots-new')?.click()
    await until(() => screen('play') !== null, 'the play screen')
    step()
    expect(lastX()).toBe(10)
    await close()
    expect(stored(host!.fakes.server, 1)).toMatchObject({ label: 'Run 2', data: { x: 10 } })
    expect(stored(host!.fakes.server, 0)).toBeUndefined()
  })

  it('keeps the slot saved while play runs: leaving play writes where the game got to', async () => {
    await boot()
    button('save-slots-new')?.click()
    await until(() => screen('play') !== null, 'the play screen')
    press('ArrowRight')
    step(4)
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowRight' }))
    press('Escape')
    await until(() => screen('paused') !== null, 'the paused screen')
    await close()
    expect(stored(host!.fakes.server, 0)?.data.x).toBe(14)
  })

  it('a second session on the same server lists the slot with its label, and Continue plays equal data (S-c)', async () => {
    await boot()
    button('save-slots-new')?.click()
    await until(() => screen('play') !== null, 'the play screen')
    press('ArrowRight')
    step(5)
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowRight' }))
    press('Escape')
    await until(() => screen('paused') !== null, 'the paused screen')
    await close()
    const server = host!.fakes.server
    const written = stored(server, 0)
    expect(written?.data.x).toBe(15)

    const seed = Object.fromEntries([...server.slots].map(([key, slot]) => [key, slot.value]))
    await boot({}, seed)
    expect(row(0)?.getAttribute('data-kind')).toBe('ready')
    expect(row(0)?.textContent).toContain('Run 1')
    expect(root.querySelector('[data-save-slot][aria-checked="true"]')?.getAttribute('data-save-slot')).toBe(
      '0',
    )
    button('save-slots-load')?.click()
    await until(() => screen('play') !== null, 'the play screen')
    step()
    expect(lastX()).toBe(15)
  })

  it('a New game whose starting data cannot be captured stays on the title with the row marked failed', async () => {
    await boot({
      saves: {
        ...saves,
        capture: () => {
          throw new Error('the sim could not be read')
        },
      },
    })
    button('save-slots-new')?.click()
    await until(() => row(0)?.getAttribute('data-activity') === 'failed', 'the row marked failed')
    expect(screen('title')).not.toBeNull()
    expect(screen('play')).toBeNull()
    // Nothing was kept in the slot, and the player can try again.
    await close()
    expect(stored(host!.fakes.server, 0)).toBeUndefined()
  })

  it('Delete asks first, and removes the slot when confirmed', async () => {
    await boot()
    button('save-slots-new')?.click()
    await until(() => screen('play') !== null, 'the play screen')
    press('Escape')
    await until(() => screen('paused') !== null, 'the paused screen')
    button('quit')?.click()
    await until(() => button('quit-confirm') !== null, 'the confirm')
    button('quit-confirm')?.click()
    await until(() => screen('title') !== null, 'the title again')
    await until(() => row(0)?.getAttribute('data-kind') === 'ready', 'the saved slot')
    button('save-slots-delete')?.click()
    await until(() => document.querySelector('[role="dialog"]') !== null, 'the question')
    expect(row(0)?.getAttribute('data-kind')).toBe('ready')
    document.querySelector<HTMLButtonElement>('[data-testid="save-slots-confirm"]')?.click()
    await until(() => row(0)?.getAttribute('data-kind') === 'empty', 'the slot gone')
  })

  it('Quit to title lets go of the slot: the next New game writes the slot chosen then', async () => {
    await boot()
    button('save-slots-new')?.click()
    await until(() => screen('play') !== null, 'the play screen')
    press('Escape')
    await until(() => screen('paused') !== null, 'the paused screen')
    button('quit')?.click()
    await until(() => button('quit-confirm') !== null, 'the confirm')
    button('quit-confirm')?.click()
    await until(() => screen('title') !== null, 'the title again')
    row(2)?.click()
    flushSync()
    await until(() => button('save-slots-new') !== null, 'New game for slot 3')
    button('save-slots-new')?.click()
    await until(() => screen('play') !== null, 'the play screen again')
    press('ArrowRight')
    step(2)
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowRight' }))
    press('Escape')
    await until(() => screen('paused') !== null, 'the paused screen again')
    await close()
    expect(stored(host!.fakes.server, 2)?.data.x).toBe(12)
    expect(stored(host!.fakes.server, 0)?.data.x).toBe(10)
  })
})
