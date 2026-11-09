import type { Command, Sim } from '@automata/sim'
import { getContext, setContext } from 'svelte'
import { type DrawSim, readSim } from '../../draw/read-sim.ts'

// What a component in the `hud.overlay` slot may do on the play screen: read the game and send it a command. Reading is
// the draw layer's read-only view (law 2: presentation observes, it never decides), made reactive so a component that
// reads `play.sim.tick` draws again each frame. Sending is a command, the only way presentation reaches the sim (law 1):
// it joins the stream the input map makes for the next tick, so anything that records that stream records it too.

/** What a slot component asks the game for: a command, without the tick, source and seq the stream fills in. */
export type SentCommand = Pick<Command, 'type' | 'payload'>

/** What `usePlay()` hands a slot component. */
export interface PlayHandle {
  /** The game as it is now, read-only; undefined until play has a sim. Reading it in a template or `$derived` follows each frame. */
  readonly sim: DrawSim | undefined
  /** Queues `command` for the next tick, after the input map's own, in the order sent. */
  send(command: SentCommand): void
}

const KEY = Symbol('af.play')

/**
 * One play screen's link to the running game: the reactive read-only view, the queue of sent commands and the
 * per-frame refresh. The default screens make one when play starts and give it to `PlayScreen`.
 */
export class PlaySession {
  #frame = $state(0)
  readonly #queue: SentCommand[] = []
  readonly handle: PlayHandle

  constructor(sim: Sim | undefined) {
    const base = sim === undefined ? undefined : readSim(sim)
    // Every read first reads `#frame`, so an effect or a `$derived` that reads the sim is tied to the frame counter.
    const follow = <T>(read: () => T): T => {
      void this.#frame
      return read()
    }
    const view: DrawSim | undefined =
      base === undefined
        ? undefined
        : Object.freeze({
            get tick() {
              return follow(() => base.tick)
            },
            query: (...components: Parameters<DrawSim['query']>) => follow(() => base.query(...components)),
            entity: (sid: number) => follow(() => base.entity(sid)),
            resource: ((def) => follow(() => base.resource(def))) as DrawSim['resource'],
          })
    this.handle = Object.freeze({ sim: view, send: (command: SentCommand) => void this.#queue.push(command) })
  }

  /** Says a frame passed, so what reads the sim reads it again. */
  refresh(): void {
    this.#frame++
  }

  /**
   * The commands for `tick`: the input map's (`input`), then the sent ones in send order, each given this tick, source 0 and a
   * seq of its own (the input map's is the tick, and a seq is used once per source in a step).
   */
  commands(tick: number, input: readonly Command[]): readonly Command[] {
    if (this.#queue.length === 0) return input
    const sent = this.#queue.splice(0).map(
      (command, index): Command => ({
        tick,
        source: 0,
        seq: tick + 1 + index,
        type: command.type,
        payload: command.payload,
      }),
    )
    return [...input, ...sent]
  }
}

/** Makes `session` what `usePlay()` returns in the components below. */
export function providePlay(session: PlaySession): void {
  setContext(KEY, session.handle)
}

/**
 * The running game, for a component the play screen draws (the `hud.overlay` slot): read it, and send it commands.
 * Call it while the component is being made, as any Svelte context.
 */
export function usePlay(): PlayHandle {
  let handle: PlayHandle | undefined
  try {
    handle = getContext<PlayHandle | undefined>(KEY)
  } catch {
    // Called outside any component: Svelte throws its own sentence, and this one says what to do.
  }
  if (handle === undefined) throw new Error('usePlay() only works in a component the play screen draws.')
  return handle
}
