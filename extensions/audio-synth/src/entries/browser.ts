// `@automata/audio-synth/browser`: the page side of the audio pipeline. Loading it puts the renderers on
// `globalThis.__automataAudio`.
import '../features/render/browser'

export type { Renderers } from '../features/render/browser'
