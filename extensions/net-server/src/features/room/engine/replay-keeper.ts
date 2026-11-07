/**
 * The room's recording: every step of a game goes through the recorder, so the replay alone reproduces the room's final
 * hash, and the packed replay is kept to offer to every client once play has ended.
 *
 * A room records from its first tick, so the replay holds every seat it ever seated. It stops recording when the game
 * ends and starts afresh, from where the sim stands, when the room plays again.
 */

import type { Command, Sim } from '@automata/sim'
import { createRecorder, packReplay, type Recorder, type ReplayCompression } from '@automata/sim/replay'
import { nodeReplayCompression } from './replay-compression'

export class ReplayKeeper {
  private readonly sim: Sim
  private readonly compression: ReplayCompression
  private recorder: Recorder | undefined
  private packed: Promise<Uint8Array> | undefined

  constructor(sim: Sim, compression: ReplayCompression = nodeReplayCompression) {
    this.sim = sim
    this.compression = compression
    this.recorder = createRecorder(sim)
  }

  /** The packed replay of the last game, once play has ended. */
  get replay(): Promise<Uint8Array> | undefined {
    return this.packed
  }

  /** Steps the sim, through the recorder while a game is recorded. */
  step(commands: readonly Command[]): ReturnType<Sim['step']> {
    return this.recorder === undefined ? this.sim.step(commands) : this.recorder.step(commands)
  }

  /** The game is over: the recording is packed (and kept), or undefined when there was none to pack. */
  finish(): Promise<Uint8Array> | undefined {
    const replay = this.recorder?.finish()
    this.recorder = undefined
    if (replay === undefined) return undefined
    this.packed = packReplay(replay, this.compression)
    return this.packed
  }

  /** Play again: the last replay is forgotten and recording begins afresh. */
  restart(): void {
    this.packed = undefined
    this.recorder = createRecorder(this.sim)
  }

  /** The room halted: no replay is kept, and nothing more is recorded. */
  discard(): void {
    this.recorder = undefined
    this.packed = undefined
  }
}
