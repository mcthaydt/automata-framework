import type { Command } from '@mcthaydt/automata-sim'
import { Context } from 'effect'

/**
 * One authoritative state: the authority sim's `snapshot()` bytes at `tick`, with its `hash()`. A receiver
 * `restore`s the bytes and may compare its own hash to `hash` to detect divergence.
 */
export interface AuthoritativeSnapshot {
  readonly tick: number
  readonly bytes: Uint8Array
  readonly hash: string
}

/**
 * The networking seam (PRODUCT spec §2 F1): remote commands in, authoritative snapshots out. The sim already
 * takes `Command`s and restores snapshot bytes, so the port carries exactly those; the wire format, rooms,
 * prediction and reconciliation belong to whatever implements it (Plus `net`, M7) or to the game.
 *
 * An authority listens with `onRemoteCommand` and answers with `publishSnapshot`; a client sends with
 * `sendCommand` and listens with `onSnapshot`. One implementation may serve either role.
 *
 * Commands cross the port every tick, so its members are plain callbacks rather than Effects (ADR 0003: no
 * Effect allocation per frame). Sends never throw: a transport failure is the implementation's to report
 * (for example as a presentation-bus fact), never a silent switch to another path. Each `on*` returns its
 * unsubscribe; a listener removed, or registered after the port's scope closed, receives nothing.
 */
export interface NetworkPort {
  /** Each command a remote peer sent, in arrival order, as the sim's own `Command`. */
  onRemoteCommand(listener: (command: Command) => void): () => void
  /** Sends one local command to the authority. */
  sendCommand(command: Command): void
  /** The authority publishes its state after a step. */
  publishSnapshot(snapshot: AuthoritativeSnapshot): void
  /** Each authoritative snapshot received, in arrival order. */
  onSnapshot(listener: (snapshot: AuthoritativeSnapshot) => void): () => void
}

/** The `NetworkPort` service tag. Core provides no implementation; an extension or the game provides one. */
export const NetworkPort: Context.Tag<NetworkPort, NetworkPort> = Context.GenericTag<NetworkPort>(
  '@mcthaydt/automata-runtime/NetworkPort',
)
