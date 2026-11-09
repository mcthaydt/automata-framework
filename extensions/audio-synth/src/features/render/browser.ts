// The page side of the audio pipeline's renderer: bundled by Vite and run in Chromium, where `OfflineAudioContext` exists. It puts
// `renderers` on `globalThis.__automataAudio` and each call returns plain number arrays, which cross `page.evaluate`.
import type { AudioContent } from '../../shared/audio.schema'
import {
  type CueRenderOptions,
  type DuckRenderOptions,
  type MixSpec,
  type OfflineLike,
  renderBed,
  renderCue,
  renderDuck,
  renderMix,
} from './render'

const env = {
  make: (channels: number, length: number, rate: number): OfflineLike =>
    new OfflineAudioContext(channels, length, rate) as unknown as OfflineLike,
}
const plain = async (out: Promise<Float32Array[]>): Promise<number[][]> =>
  (await out).map((c) => Array.from(c))

/**
 * The offline renderers the page offers the audio pipeline: a cue, a bed, a mix and the ducking
 * demonstration, each answering plain number arrays.
 */
export interface Renderers {
  cue(content: AudioContent, id: string, options: CueRenderOptions): Promise<number[][]>
  bed(content: AudioContent, id: string, seconds: number): Promise<number[][]>
  mix(content: AudioContent, mix: MixSpec): Promise<number[][]>
  duck(content: AudioContent, options: DuckRenderOptions): Promise<number[][]>
}
export const renderers: Renderers = {
  cue: (content, id, options) => plain(renderCue(env, content, id, options)),
  bed: (content, id, seconds) => plain(renderBed(env, content, id, seconds)),
  mix: (content, mix) => plain(renderMix(env, content, mix)),
  duck: (content, options) => plain(renderDuck(env, content, options)),
}

// Assigned on import: the page bundle is this module and nothing calls into it. `package.json` lists it under `sideEffects`.
;(globalThis as { __automataAudio?: Renderers }).__automataAudio = renderers
