// The handles debug panels read (DBG-D1): core gives slot components no services context, so the game hands `installDebug` what
// it wants shown and the overlay passes it down through Svelte context. Every handle is optional; a panel whose handle is missing
// says so instead of throwing. Nothing here writes the sim: the only game-changing handles are Flow's pause and the feel board.
import type { DebugPanelDef } from './panels'

/** The presentation bus, as far as the debug panels need it. */
export interface BusPort {
  subscribe(name: string, listener: (fact: unknown) => void): () => void
}
/** What the sim panel shows, read each time the panel refreshes. */
export interface SimProbe {
  tick(): number
  entities(): number
  /** The last state hash, as a string. */
  hash(): string
  /** Milliseconds the last step took. */
  stepMs(): number
}
/** The feel board: every event the content reacts to, and a way to fire one. */
export interface FeelBoardPort {
  entries(): readonly string[]
  fire(on: string): void
}
/** One cue on the audio board: its bus, its line, and the sim events that play it. */
export interface AudioBoardCue {
  readonly id: string
  readonly bus: string
  readonly about?: string
  readonly draft: boolean
  readonly events: readonly string[]
}
export interface AudioBoardBed {
  readonly id: string
  readonly bus: string
  readonly about?: string
  readonly draft: boolean
}
/** The audio board: every cue and bed, and a way to play them through the mixer the game installed. */
export interface AudioBoardPort {
  cues(): readonly AudioBoardCue[]
  beds(): readonly AudioBoardBed[]
  play(cue: string): void
  startBed(id: string): void
  stopBed(id: string): void
  /** The beds playing now. */
  playing(): readonly string[]
}
/** The net diagnostics: a summary object (`NetDiagnostics.summary()`), read as rows. */
export interface NetDiagnosticsPort {
  summary(): unknown
}
export interface DebugHost {
  readonly panels: readonly DebugPanelDef[]
  readonly bus?: BusPort | undefined
  /** The facts to record for the bus panel; the runtime's by default. */
  readonly facts?: readonly string[] | undefined
  readonly sim?: SimProbe | undefined
  readonly feel?: FeelBoardPort | undefined
  readonly audio?: AudioBoardPort | undefined
  readonly net?: NetDiagnosticsPort | undefined
  /** Flow's existing pause, for the overlay's "Pause sim" toggle. */
  readonly setPaused?: ((paused: boolean) => void) | undefined
  /** The game's test driver (DBG-D3): named functions a Playwright playthrough calls, exposed as `window.__automataDebug`. */
  readonly driver?: Readonly<Record<string, (...args: never[]) => unknown>> | undefined
}

let current: DebugHost | undefined

type DriverHandle = Readonly<Record<string, unknown>>
const globals = (): { __automataDebug?: DriverHandle | undefined } => globalThis as never

/**
 * Makes `host` the one the overlay shows, and its driver (if any) `window.__automataDebug`, with `panels()` added. Returns a
 * dispose that removes both, unless a later install has replaced them.
 */
export function installDebug(host: DebugHost): () => void {
  current = host
  const handle: DriverHandle | undefined =
    host.driver === undefined ? undefined : { ...host.driver, panels: () => host.panels.map((p) => p.id) }
  globals().__automataDebug = handle
  return () => {
    if (current === host) current = undefined
    if (globals().__automataDebug === handle) globals().__automataDebug = undefined
  }
}
/** The installed host, if any. */
export const currentHost = (): DebugHost | undefined => current

/** The Svelte context key panels use to get the host from the overlay. */
export const HOST_CONTEXT: unique symbol = Symbol('automata-debug-host')
