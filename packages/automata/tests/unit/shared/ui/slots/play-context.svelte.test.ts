import {
  type Command,
  createSim,
  defineCommand,
  definePlugin,
  defineResource,
  defineSystem,
  type Sim,
} from '@automata/sim'
import { flushSync, mount, unmount } from 'svelte'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import PlayScreen from '#src/app/screens/PlayScreen.svelte'
import { DEFAULT_SCREENS_COPY } from '#src/app/screens/screens-copy.ts'
import { InputMethodTracker } from '#src/shared/ui/browser/input-method.svelte.ts'
import { PlaySession, usePlay } from '#src/shared/ui/slots/play-context.svelte.ts'
import PlayProbe from '../../../../fixtures/ui/PlayProbe.svelte'

// What a slot component may do on the play screen: read the game, as the draw layer does (read-only), and send a command.
// The sent commands join the stream the input map makes, so a recording of that stream replays them.

const Bump = defineCommand('probe.bump', z.object({ by: z.number().int() }))
const Count = defineResource('probe.count', z.object({ n: z.number() }), () => ({ n: 0 }))
const probe = definePlugin({
  name: 'probe',
  commands: [Bump],
  resources: [Count],
  systems: [
    defineSystem('probe.bump', 'gameplay', (ctx) => {
      for (const { payload } of ctx.commands.of(Bump)) ctx.resource(Count).n += payload.by
    }),
  ],
})
const newSim = (): Promise<Sim> => createSim({ seed: 1, plugins: [probe] })

let sims: Sim[] = []
let mounted: ReturnType<typeof mount> | undefined
afterEach(() => {
  if (mounted !== undefined) unmount(mounted)
  mounted = undefined
  for (const sim of sims) sim.dispose()
  sims = []
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})

async function open() {
  const sim = await newSim()
  sims.push(sim)
  const session = new PlaySession(sim)
  const host = document.createElement('div')
  document.body.append(host)
  const tracker = new InputMethodTracker()
  mounted = mount(PlayScreen, {
    target: host,
    props: {
      onPause: () => {},
      copy: { current: DEFAULT_SCREENS_COPY },
      tracker,
      touchButtons: [],
      onHold: () => {},
      onRelease: () => {},
      hud: [PlayProbe],
      play: session,
    },
  })
  flushSync()
  return { sim, session, host }
}

describe('usePlay on the play screen', () => {
  it('shows a slot component the sim as it is now, and again after the session says a frame passed', async () => {
    const { sim, session, host } = await open()
    const shown = () => host.querySelector('[data-testid=tick]')?.textContent
    expect(shown()).toBe('0')
    sim.step([])
    sim.step([])
    session.refresh()
    flushSync()
    expect(shown()).toBe('2')
  })

  it('refreshes by itself each animation frame while the screen is up', async () => {
    const frames: (() => void)[] = []
    vi.stubGlobal('requestAnimationFrame', (callback: () => void) => frames.push(callback))
    vi.stubGlobal('cancelAnimationFrame', () => {})
    const { sim, host } = await open()
    sim.step([])
    for (const frame of frames.splice(0)) frame()
    flushSync()
    expect(host.querySelector('[data-testid=tick]')?.textContent).toBe('1')
  })

  it('reads the game through the same read-only view the draw layer has', async () => {
    const { session } = await open()
    const view = session.handle.sim
    if (view === undefined) throw new Error('no sim')
    expect(Object.isFrozen(view.resource(Count))).toBe(true)
  })

  it('says where usePlay works when it is called outside a play screen', () => {
    expect(() => usePlay()).toThrow('usePlay() only works in a component the play screen draws')
  })
})

describe('commands a slot component sends', () => {
  it('queues the button’s command for the next tick, after the input map’s, in the order sent', async () => {
    const { session, host } = await open()
    host.querySelector<HTMLButtonElement>('[data-testid=bump]')?.click()
    session.handle.send({ type: 'probe.bump', payload: { by: 5 } })
    const input: Command = { tick: 10, source: 0, seq: 10, type: 'probe.bump', payload: { by: 1 } }
    const stream = session.commands(10, [input])
    expect(stream.map((command) => (command.payload as { by: number }).by)).toEqual([1, 2, 5])
    expect(stream.every((command) => command.tick === 10 && command.source === 0)).toBe(true)
    expect(new Set(stream.map((command) => command.seq)).size).toBe(3)
    // Sent once only.
    expect(session.commands(11, [])).toEqual([])
  })

  it('replays: the recorded stream reaches the same state hash on a fresh sim', async () => {
    const { sim, session } = await open()
    const recorded: (readonly Command[])[] = []
    for (let tick = 0; tick < 12; tick++) {
      if (tick === 3) session.handle.send({ type: 'probe.bump', payload: { by: 4 } })
      if (tick === 9) session.handle.send({ type: 'probe.bump', payload: { by: 1 } })
      const stream = session.commands(tick, [])
      recorded.push(stream)
      sim.step(stream)
    }
    const fresh = await newSim()
    sims.push(fresh)
    for (const stream of recorded) fresh.step(stream)
    expect(fresh.hash()).toBe(sim.hash())
    expect(fresh.resource(Count).n).toBe(5)
  })
})
