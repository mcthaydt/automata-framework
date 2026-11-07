// @automata/sim/replay: record a run, store it as a `.replay`, and play it back bit-identically
//.
export { decodeReplay, encodeReplay } from '../features/replay/codec'
export { ReplayFormatError, ReplayRecordError } from '../features/replay/errors'
export {
  packReplay,
  REPLAY_INFLATE_MAX_BYTES,
  type ReplayCompression,
  unpackReplay,
} from '../features/replay/pack'
export { createRecorder, type Recorder, type RecorderOptions } from '../features/replay/recorder'
export {
  DEFAULT_CHECK_EVERY,
  REPLAY_FORMAT,
  REPLAY_MAX_TICKS,
  type Replay,
  type ReplayCommand,
  type ReplayHeader,
} from '../features/replay/replay'
export {
  createReplayStepper,
  type ReplayCheck,
  type ReplayStepper,
  type ReplayStepSetup,
} from '../features/replay/stepper'
