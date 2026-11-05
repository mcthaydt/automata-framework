import {
  defineCommand,
  defineComponent,
  definePlugin,
  defineSystem,
  type Sim,
  type StepResult,
} from '@mcthaydt/automata-sim'
import { createFakeHost, type FakeHostOptions, settle } from '@ruken/sdk-host/testing'
import { flushSync } from 'svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { type DefinedGame, defineGame, type GameSaves, type GameSpec } from '#src/app/define-game.ts'
import { keys } from '#src/features/input/keys.ts'
import { ok } from '#src/shared/lib/result.ts'
import type { RuntimeHandle } from '../../../../../src/app/boot/game-definition.ts'
import { runGame } from '../../../../../src/app/boot/run-game.ts'
import { defineSave } from '../../../../../src/features/saves/save.schema.ts'
import type { GameRenderer, RendererFactory } from '../../../../../src/shared/runtime/render/renderer.ts'
import { manualClock, realClock } from '../../../../../src/testing/host/page/clocks.ts'
import { TEST_GAME_ORIGIN } from '../../../../../src/testing/host/page/ruken/hosting-test.ts'
import { fakeFetch } from '../../../../../src/testing/runtime/fake-fetch.ts'
import { type ManualFrames, manualFrames } from '../../../../../src/testing/runtime/manual-frames.ts'

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
  return async () => ok({ ...renderer, dispose: () => {} })
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
    hostOptions: Partial<FakeHostOptions> | 'standalone' = {},
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
        // Standalone: no host frame, so the SDK runs by itself and there is nothing to sync.
        ...(hostOptions === 'standalone'
          ? {}
          : {
              sdkEnv: () => {
                host = createFakeHost({
                  gameOrigin: TEST_GAME_ORIGIN,
                  gameId: 'saves-screens',
                  clock: realClock,
                  saves: seed,
                  ...hostOptions,
                })
                if (host.gameEnv === undefined || host.gameEnv === null)
                  throw new Error('the fake host has no game environment')
                return host.gameEnv
              },
            }),
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

  it('names the slots and their actions in the game’s words from copy.screens (DX.2d)', async () => {
    await boot({
      copy: {
        screens: {
          saves: { slots: { slot: (slot) => `Emplacement ${slot + 1}`, newGame: 'Nouvelle partie' } },
        },
      },
    })
    expect(row(0)?.textContent).toContain('Emplacement 1')
    expect(button('save-slots-new')?.textContent).toContain('Nouvelle partie')
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

  it('a shutdown during play with no host exit first still writes where the game got to, and only then disposes the sim (DX.2c)', async () => {
    await boot()
    button('save-slots-new')?.click()
    await until(() => screen('play') !== null, 'the play screen')
    press('ArrowRight')
    step(4)
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowRight' }))
    expect(sims).toHaveLength(1)
    const dispose = vi.spyOn(sims[0] as Sim, 'dispose')
    await handle?.shutdown()
    handle = undefined
    await settle(4)
    expect(dispose).toHaveBeenCalledTimes(1)
    // The save's last flush read the live sim: a sim disposed before it would have left only New game's x = 10.
    const written = host!.messages
      .filter((entry) => entry.dir === 'in' && entry.msg.type === 'saves.set')
      .map((entry) => JSON.parse((entry.msg.payload as { value: string }).value) as { data: { x: number } })
    expect(written.map((envelope) => envelope.data.x)).toEqual([10, 14])
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
  describe('paused (M5.2)', () => {
    const line = () => root.querySelector<HTMLElement>('[data-save-status]')
    /** New game in slot 1, then pause. */
    async function pauseInNewGame(): Promise<void> {
      button('save-slots-new')?.click()
      await until(() => screen('play') !== null, 'the play screen')
      press('Escape')
      await until(() => screen('paused') !== null, 'the paused screen')
    }

    it('says in words what the host has done with the progress, following it as it changes', async () => {
      await boot()
      await pauseInNewGame()
      await until(() => line()?.dataset.state === 'saved', 'the host to have saved')
      expect(line()?.textContent).toContain('Progress saved')
      expect(line()?.getAttribute('role')).toBe('status')
    })

    it('says it in the game’s words from copy.screens (DX.2d)', async () => {
      await boot({ copy: { screens: { saves: { status: { saved: 'Progression enregistrée' } } } } })
      await pauseInNewGame()
      await until(() => line()?.dataset.state === 'saved', 'the host to have saved')
      expect(line()?.textContent).toContain('Progression enregistrée')
    })

    it('shows no status on a game without a save', async () => {
      await boot({}, {}, false)
      button('play')?.click()
      await until(() => screen('play') !== null, 'the play screen')
      press('Escape')
      await until(() => screen('paused') !== null, 'the paused screen')
      expect(line()).toBeNull()
    })

    it('shows no status standalone, where nothing syncs', async () => {
      await boot({}, {}, true, 'standalone')
      await pauseInNewGame()
      expect(line()).toBeNull()
    })

    it("says Progress won't be kept under a host that did not grant saves", async () => {
      await boot({}, {}, true, { grant: [] })
      await pauseInNewGame()
      await until(() => line()?.dataset.state === 'no-grant', 'the no-grant line')
      expect(line()?.textContent).toContain("Progress won't be kept")
    })
    // The fake host pushes `saves.changed` only when a conflict is answered (Ruken request R-7), so another device's
    // write arrives the way it does for a player: a write of this game's loses to it, and the player answers "theirs".
    describe('another device changes the slot being played (M5-D6)', () => {
      const hostClock = manualClock()

      /** Session A ends with slot 1 saved; session B continues it, and then a second device writes the slot. */
      async function playWhileOtherDeviceWrites(): Promise<void> {
        await boot()
        await pauseInNewGame()
        await close()
        const server = host!.fakes.server
        const seed = Object.fromEntries([...server.slots].map(([key, slot]) => [key, slot.value]))
        await boot({}, seed, true, { clock: hostClock })
        button('save-slots-load')?.click()
        await until(() => screen('play') !== null, 'the play screen')
        const mine = host!.fakes.server.slots.get('run.slot.0')?.value ?? ''
        const envelope = JSON.parse(mine) as { data: { x: number }; label?: string; savedAt: number }
        host!.fakes.server.remoteWrite(
          'run.slot.0',
          JSON.stringify({ ...envelope, data: { x: 99 }, label: 'Desk PC', savedAt: envelope.savedAt + 1 }),
          'Desk PC',
        )
        // This game's progress moves, and pausing writes it: the write loses to the other device's.
        press('ArrowRight')
        step(3)
        window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowRight' }))
        press('Escape')
        await until(() => screen('paused') !== null, 'the paused screen')
        await settle(4)
        hostClock.advance(60_000)
        await settle(4)
        button('resume')?.click()
        await until(() => screen('play') !== null, 'the play screen again')
        await Promise.resolve(host!.bridge.resolveConflict('run.slot.0', 'theirs'))
        await settle(4)
      }

      it('tells play in a Toast, and changes nothing under the player', async () => {
        await playWhileOtherDeviceWrites()
        await until(() => root.querySelector('[data-testid="changed-elsewhere"]') !== null, 'the toast')
        expect(root.querySelector('[data-testid="changed-elsewhere"]')?.textContent).toContain(
          'Your progress changed on another device',
        )
        expect(screen('play')).not.toBeNull()
      })

      it('offers Load newer and Keep playing at the next pause; Keep playing lowers the choice', async () => {
        await playWhileOtherDeviceWrites()
        press('Escape')
        await until(() => screen('paused') !== null, 'the paused screen')
        await until(() => root.querySelector('[data-changed-elsewhere]') !== null, 'the choice')
        expect(button('load-newer')).not.toBeNull()
        button('keep-playing')?.click()
        await until(() => root.querySelector('[data-changed-elsewhere]') === null, 'the choice gone')
        expect(screen('paused')).not.toBeNull()
      })

      it('Load newer that cannot be applied says so, and the game goes on as it was', async () => {
        const refusing: GameSaves<{ x: number }> = {
          ...saves,
          apply: (sim, data) => {
            if (data.x === 99) throw new Error('the newer progress does not fit this sim')
            saves.apply(sim, data)
          },
        }
        await boot()
        await pauseInNewGame()
        await close()
        const seed = Object.fromEntries([...host!.fakes.server.slots].map(([key, slot]) => [key, slot.value]))
        await boot({ saves: refusing }, seed, true, { clock: hostClock })
        button('save-slots-load')?.click()
        await until(() => screen('play') !== null, 'the play screen')
        const envelope = JSON.parse(host!.fakes.server.slots.get('run.slot.0')?.value ?? '') as {
          data: { x: number }
          savedAt: number
        }
        host!.fakes.server.remoteWrite(
          'run.slot.0',
          JSON.stringify({ ...envelope, data: { x: 99 }, savedAt: envelope.savedAt + 1 }),
          'Desk PC',
        )
        press('ArrowRight')
        step(3)
        window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowRight' }))
        press('Escape')
        await until(() => screen('paused') !== null, 'the paused screen')
        await settle(4)
        hostClock.advance(60_000)
        await settle(4)
        button('resume')?.click()
        await until(() => screen('play') !== null, 'the play screen again')
        await Promise.resolve(host!.bridge.resolveConflict('run.slot.0', 'theirs'))
        await settle(4)
        press('Escape')
        await until(() => button('load-newer') !== null, 'the choice')
        button('load-newer')?.click()
        await until(() => root.querySelector('[data-load-failed]') !== null, 'the failure line')
        // The game goes on as it was: still paused, and Resume plays the sim it had.
        expect(screen('paused')).not.toBeNull()
        button('resume')?.click()
        await until(() => screen('play') !== null, 'the play screen again')
        step()
        expect(lastX()).toBe(13)
      })

      it('Load newer plays what the other device wrote, which the pause did not write over', async () => {
        await playWhileOtherDeviceWrites()
        // Play goes on after the Toast, so the game has progress of its own to keep when the pause opens.
        step(3)
        press('Escape')
        await until(() => screen('paused') !== null, 'the paused screen')
        await until(() => button('load-newer') !== null, 'the choice')
        button('load-newer')?.click()
        await until(() => screen('play') !== null, 'play again, on the newer progress')
        step()
        expect(lastX()).toBe(99)
        // However long the host waits to sync, what it holds for the slot is the other device's.
        hostClock.advance(60_000)
        await settle(4)
        const held = host!.fakes.server.slots.get('run.slot.0')?.value ?? ''
        expect(JSON.parse(held)).toMatchObject({ label: 'Desk PC', data: { x: 99 } })
      })
    })
  })
})
