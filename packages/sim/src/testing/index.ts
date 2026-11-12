// @automataframework/sim/testing: goldens, replays and the snapshot property test for sim code. No Svelte, so a sim-only package can use it; loadable in a browser page and in Node.
export { goldenCommands } from './commands.ts'
export { nodeCompression, streamCompression } from './compression.ts'
export { type Difference, diffSnapshotViews } from './diff.ts'
export {
  type RoundTripFailure,
  type RoundTripOptions,
  type RoundTripVariant,
  snapshotRoundTripProperty,
} from './property.ts'
export { GOLDEN_MAX_PACKED_BYTES, type ReplayGoldenOptions, replayGolden } from './replay-golden.ts'
export { expectGolden, formatGoldenReport, type GoldenReport } from './report.ts'
export { type SimGoldenOptions, simGolden } from './sim-golden.ts'
