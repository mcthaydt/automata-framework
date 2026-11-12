import { CameraHeading, CameraYaw } from '@automata/3d/sim'
import { CutsceneState } from '@automata/cutscenes/sim'
import { useCommands } from '@automata/interact'
import { Combine, EnterCode, Use } from '@automata/interact/sim'
import { PuzzleState } from '@automata/puzzle/sim'
import { ToggleLight } from '@automata/systems/sim'
import { Ada } from '../shared/ada.component.ts'
import type { PlayContent } from '../shared/play-content.ts'
import type { Live } from './live.ts'
import { adaAt } from './presentation.ts'

// A development build tells a journey what the sim does and lets it send what a player's controls send, so a browser test
// waits on the game's own state (never on a sleep) and plays the prologue through the page's real renderer. It reads through the
// draw layer's view and sends commands; a release build never has it (`__AUTOMATA_DEBUG__` is false there).

declare const __AUTOMATA_DEBUG__: boolean

/** Turn units in a whole turn, as the sim counts a heading. */
const TURN = 65_536

/** What a journey reads. */
export interface ProbeState {
  readonly tick: number
  /** The cutscene playing, or null. */
  readonly cutscene: string | null
  readonly facts: Readonly<Record<string, unknown>>
  readonly items: readonly string[]
  readonly ada: { readonly x: number; readonly z: number } | undefined
  /** The camera's heading, in turn units (65,536 a turn); undefined with no Ada. */
  readonly heading: number | undefined
  /** How many events of each type the sim has made since the page started. */
  readonly events: Readonly<Record<string, number>>
}

/** What a journey may do: the commands the controls send, by the names the bot uses. */
export interface Probe {
  state(): ProbeState | undefined
  tap(at: string, held?: string): void
  combine(a: string, b: string): void
  code(code: string): void
  lamp(): void
  skip(): void
  /** Walks Ada to a point on the plan (metres), as a tap's walk does: a shot is placed in the room's coordinates, whatever the camera's heading. */
  walk(x: number, z: number): void
  /**
   * Turns the camera toward a heading in degrees (0 looks toward +z), the shorter way, by one `camera-yaw` command, as a drag does. The sim
   * turns at most 45 degrees a tick, so a journey sends it again until `heading` says it is there.
   */
  face(deg: number): void
}

declare global {
  var __lastLight: Probe | undefined
}

/** Starts the probe if this is a development build; returns what takes it away. */
export function installProbe(
  live: Live,
  play: PlayContent,
): { note(events: readonly { type: string }[]): void } {
  const counts: Record<string, number> = {}
  const note = (events: readonly { type: string; payload?: unknown }[]): void => {
    if (!__AUTOMATA_DEBUG__) return
    for (const event of events) {
      counts[event.type] = (counts[event.type] ?? 0) + 1
      // A cutscene's end says which, and whether it was played out or skipped.
      const ended = event as { type: string; payload?: { id?: string; skipped?: boolean } }
      if (event.type === 'cutscene.ended' && ended.payload?.id !== undefined) {
        const key = `cutscene.ended:${ended.payload.id}:${ended.payload.skipped === true ? 'skipped' : 'played'}`
        counts[key] = (counts[key] ?? 0) + 1
      }
    }
  }
  if (__AUTOMATA_DEBUG__) {
    const send = (type: string, payload: unknown): void => live.send({ type, payload })
    globalThis.__lastLight = {
      state: () => {
        const sim = live.sim
        if (sim === undefined) return undefined
        const puzzle = sim.resource(PuzzleState)
        return {
          tick: sim.tick,
          cutscene: sim.resource(CutsceneState).id,
          facts: puzzle.facts,
          items: puzzle.items,
          ada: adaAt(sim),
          heading: sim.query(Ada, CameraHeading)[0]?.get(CameraHeading).heading,
          events: { ...counts },
        }
      },
      tap: (at, held) => {
        const ada = live.sim?.query(Ada)[0]
        const spot = play.hotspots.find((hotspot) => hotspot.id === at)
        if (ada === undefined || spot === undefined) return
        const [walk, use] = useCommands(ada.sid, spot, held)
        send('nav.walk-to', walk)
        send(Use.id, use)
      },
      combine: (a, b) => send(Combine.id, { a, b }),
      code: (code) => send(EnterCode.id, { code }),
      lamp: () => send(ToggleLight.id, {}),
      skip: () => send('cutscene.skip', {}),
      walk: (x, z) => {
        const ada = live.sim?.query(Ada)[0]
        if (ada !== undefined) send('nav.walk-to', { entity: ada.sid, to: { x, z } })
      },
      face: (deg) => {
        const heading = live.sim?.query(Ada, CameraHeading)[0]?.get(CameraHeading).heading
        if (heading === undefined) return
        // The shorter way round, in whole turn units (65,536 a turn), at most the 45 degrees the sim takes in a tick.
        const turn =
          ((((Math.round((deg * TURN) / 360) - heading) % TURN) + TURN + TURN / 2) % TURN) - TURN / 2
        send(CameraYaw.id, { units: Math.max(-TURN / 8, Math.min(TURN / 8, turn)) })
      },
    }
  }
  return { note }
}
