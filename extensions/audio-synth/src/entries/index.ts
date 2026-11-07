// @automata/audio-synth: synthesized cues, beds and music slots as data, played on core's audio buses.
// Presentation only.
export { audioContent } from '../features/synth/audio.content'
export {
  type AudioSynth,
  type AudioSynthOptions,
  type Coverage,
  coverage,
  createAudioSynth,
  rowFor,
} from '../features/synth/audio-synth'
export { audioSynthExtension } from '../features/synth/audio-synth.extension'
export {
  type Candidate,
  createMusicDirector,
  holds,
  type MusicDirector,
  type MusicDirectorOptions,
  type MusicState,
  resolveSlot,
  slotFor,
  slotsFor,
} from '../features/synth/music'
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
} from '../shared/audio.schema'
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
} from '../shared/mixer'
export { cueLength, noiseBuffer, playCue, playVoice, startBed } from '../shared/synth'
