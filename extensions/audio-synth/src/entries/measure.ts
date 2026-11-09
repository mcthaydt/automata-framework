// `@automata/audio-synth/measure`: WAV files, loudness, true peak, clicks and decay. Plain TypeScript, no audio stack.
export { type ClickOptions, clicks, decay, rms } from '../features/measure/clicks'
export { integratedLoudness, truePeak } from '../features/measure/loudness'
export { decodeWav, encodeWav, type Wav } from '../features/measure/wav'
