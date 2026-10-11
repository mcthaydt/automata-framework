// @mcthaydt/automata-sim/replay: record a run, store it as a `.replay`, and play it back bit-identically
// (M2.3 spec §3).
export { decodeReplay, encodeReplay } from './codec'
export { ReplayFormatError, ReplayRecordError } from './errors'
export { packReplay, REPLAY_INFLATE_MAX_BYTES, type ReplayCompression, unpackReplay } from './pack'
export { createRecorder, type Recorder, type RecorderOptions } from './recorder'
export {
  DEFAULT_CHECK_EVERY,
  REPLAY_FORMAT,
  REPLAY_MAX_TICKS,
  type Replay,
  type ReplayCommand,
  type ReplayHeader,
} from './replay'
export { createReplayStepper, type ReplayCheck, type ReplayStepper, type ReplayStepSetup } from './stepper'
