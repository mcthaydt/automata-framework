import { type PluginState, type PluginStateSetup, SnapshotFormatError } from '@mcthaydt/automata-sim'
import { RACE_TICK_HZ } from './tuning.schema'

// The race's tick-rate check: the fast-fall bound (8b-D4) is per tick of RACE_TICK_HZ, so a sim at another rate could
// let a racer pass a floor. A plugin's state hook is the one place a plugin learns the sim's step at createSim, so the
// check runs there, once, and never inside a step. The state holds nothing: its snapshot bytes are empty.

/** The race plugin's `state`: fails createSim unless the sim steps at RACE_TICK_HZ. */
export async function checkTickRate({ dt }: PluginStateSetup): Promise<PluginState> {
  if (dt !== 1 / RACE_TICK_HZ)
    throw new Error(`the race is tuned for ${RACE_TICK_HZ} Hz; create its sim with tickHz: RACE_TICK_HZ`)
  return {
    snapshot: () => new Uint8Array(0),
    prepareRestore(bytes) {
      if (bytes.length !== 0) throw new SnapshotFormatError('the race plugin keeps no state bytes')
      return { commit() {}, discard() {} }
    },
    dispose() {},
  }
}
