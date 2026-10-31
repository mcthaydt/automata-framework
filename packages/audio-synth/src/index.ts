// @mcthaydt/automata-audio-synth: synthesized cues, beds and music slots as data (M6 spec §4.10), played on core's audio buses.
// Presentation only.
export { audioContent } from './audio.content'
export {
  type AudioContent,
  audioSchema,
  type Bed,
  BUSES,
  type BusId,
  type Condition,
  type Cue,
  type DuckRule,
  type EventRow,
  type Fallback,
  FILTERS,
  type FilterId,
  type MusicRule,
  type Slot,
  type StateValue,
  type Voice,
  WAVES,
  type Wave,
} from './audio.schema'
export {
  type AudioSynth,
  type AudioSynthOptions,
  type Coverage,
  coverage,
  createAudioSynth,
  rowFor,
} from './audio-synth'
export {
  createMixer,
  DISTANCE,
  dbToGain,
  type Listener,
  type Mixer,
  type MixerOptions,
  type MixerPort,
  PAN_WIDTH,
  type PlayOptions,
  type Spatial,
  spatial,
} from './mixer'
export { cueLength, noiseBuffer, playCue, playVoice, startBed } from './synth'
