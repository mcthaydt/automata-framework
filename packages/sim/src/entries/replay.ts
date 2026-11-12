// @automataframework/sim/replay: record a run, store it as a `.replay`, and play it back bit-identically
//.
export { decodeReplay, encodeReplay } from '../features/replay/codec.ts'
export { ReplayFormatError, ReplayRecordError } from '../features/replay/errors.ts'
export {
  packReplay,
  REPLAY_INFLATE_MAX_BYTES,
  type ReplayCompression,
  unpackReplay,
} from '../features/replay/pack.ts'
export { createRecorder, type Recorder, type RecorderOptions } from '../features/replay/recorder.ts'
export {
  DEFAULT_CHECK_EVERY,
  REPLAY_FORMAT,
  REPLAY_MAX_TICKS,
  type Replay,
  type ReplayCommand,
  type ReplayHeader,
} from '../features/replay/replay.ts'
export {
  createReplayStepper,
  type ReplayCheck,
  type ReplayStepper,
  type ReplayStepSetup,
} from '../features/replay/stepper.ts'
