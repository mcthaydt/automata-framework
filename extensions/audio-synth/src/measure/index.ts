// `@automata/audio-synth/measure`: WAV files, loudness, true peak, clicks and decay. Plain TypeScript, no audio stack.
export { type ClickOptions, clicks, decay, rms } from './clicks'
export { integratedLoudness, truePeak } from './loudness'
export { decodeWav, encodeWav, type Wav } from './wav'
