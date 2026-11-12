// A running game with no screen, for tests and the bot: the sim on the game's own content, and the commands a player's
// input sends (the stick, a tap on a hotspot, combining two items, the lamp's switch, a keypad's code). Tests and tools only.
import { content } from 'virtual:automata/content'
import { useCommands } from '@automata/interact'
import { Combine, EnterCode, type Hotspot, Use } from '@automata/interact/sim'
import { PuzzleSaid, PuzzleState } from '@automata/puzzle/sim'
import { InSector } from '@automata/sectors/sim'
import type { Command, EventDef, Sim, SimEvent } from '@automata/sim'
import { ToggleLight } from '@automata/systems/sim'
import { playOf } from '../app/content.ts'
import { createGameSim } from '../app/game-sim.ts'
import { Move } from '../features/ada/move.command.ts'
import { Ada } from '../shared/ada.component.ts'
import { TICK_HZ } from '../shared/constants.ts'
import type { PlayContent } from '../shared/play-content.ts'

export interface Game {
  readonly sim: Sim
  readonly play: PlayContent
  /** Every event so far, in order. */
  readonly log: SimEvent[]
  /** Steps once with these commands, from player slot 0. */
  send(commands: readonly { readonly type: string; readonly payload: unknown }[]): readonly SimEvent[]
  /** Steps `seconds` with the stick held at (x, y), or with none. */
  hold(seconds: number, stick?: { readonly x: number; readonly y: number }): void
  /** What a tap on a hotspot sends: the walk and the use, in one tick; then `seconds` of waiting. */
  tap(at: string, options?: { readonly held?: string; readonly seconds?: number }): void
  combine(a: string, b: string): void
  code(code: string): void
  lamp(): void
  ada(): { readonly x: number; readonly z: number }
  items(): readonly string[]
  fact(name: string): unknown
  events(def: EventDef): unknown[]
  said(): string[]
  hotspot(id: string): Hotspot
  /** Ends the sim; a test that makes many games may call it, and the harness ends the oldest on its own. */
  dispose(): void
}

/** The sims this process made and has not disposed: Koota keeps at most 16 worlds, so the oldest go when there are many. */
const ALIVE: Sim[] = []
const MOST_ALIVE = 8

/** The game booted, Ada at the spawn, the first tick stepped (the scene loads on it). */
export async function boot(seed = 1, play: PlayContent = playOf(content)): Promise<Game> {
  const sim = await createGameSim(play, seed)
  ALIVE.push(sim)
  while (ALIVE.length > MOST_ALIVE) (ALIVE.shift() as Sim).dispose()
  const log: SimEvent[] = []
  const send: Game['send'] = (commands) => {
    const result = sim.step(commands.map((c, seq): Command => ({ tick: sim.tick, source: 0, seq, ...c })))
    log.push(...result.events)
    return result.events
  }
  send([])
  const adaEntity = () => {
    const [ada] = sim.query(Ada, InSector)
    if (ada === undefined) throw new Error('the sim has no Ada')
    return ada
  }
  const hotspot = (id: string): Hotspot => {
    const found = play.hotspots.find((spot) => spot.id === id)
    if (found === undefined) throw new Error(`the level has no hotspot "${id}"`)
    return found
  }
  const hold: Game['hold'] = (seconds, stick) => {
    for (let i = 0; i < Math.round(seconds * TICK_HZ); i += 1)
      send(stick === undefined ? [] : [{ type: Move.id, payload: stick }])
  }
  return {
    sim,
    play,
    log,
    send,
    hold,
    tap(at, options = {}) {
      const [walk, use] = useCommands(adaEntity().sid, hotspot(at), options.held)
      send([
        { type: 'nav.walk-to', payload: walk },
        { type: Use.id, payload: use },
      ])
      hold(options.seconds ?? 0)
    },
    combine: (a, b) => void send([{ type: Combine.id, payload: { a, b } }]),
    code: (code) => void send([{ type: EnterCode.id, payload: { code } }]),
    lamp: () => void send([{ type: ToggleLight.id, payload: {} }]),
    ada: () => adaEntity().get(InSector),
    items: () => sim.resource(PuzzleState).items,
    fact: (name) => sim.resource(PuzzleState).facts[name],
    events: (def) => log.filter((event) => event.type === def.id).map((event) => event.payload),
    said: () =>
      log
        .filter((event) => event.type === PuzzleSaid.id)
        .map((event) => (event.payload as { line: string }).line),
    hotspot,
    dispose: () => {
      const at = ALIVE.indexOf(sim)
      if (at >= 0) ALIVE.splice(at, 1)
      sim.dispose()
    },
  }
}
