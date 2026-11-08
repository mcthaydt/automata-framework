// @mcthaydt/automata-sim/testing: goldens, replays and the snapshot property test for sim code. No Svelte, so a sim-only package can use it; loadable in a browser page and in Node.
export { goldenCommands } from './commands'
export { nodeCompression, streamCompression } from './compression'
export { type Difference, diffSnapshotViews } from './diff'
export {
  type RoundTripFailure,
  type RoundTripOptions,
  type RoundTripVariant,
  snapshotRoundTripProperty,
} from './property'
export { GOLDEN_MAX_PACKED_BYTES, type ReplayGoldenOptions, replayGolden } from './replay-golden'
export { expectGolden, formatGoldenReport, type GoldenReport } from './report'
export { type SimGoldenOptions, simGolden } from './sim-golden'
