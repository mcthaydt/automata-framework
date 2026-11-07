// @automata/3d/timeline: keyed tracks, eases and the sampler, the one timeline the figures' clips, the lights and the
// scripted scenes of `@automata/cutscenes` share. It reaches nothing but `shared/timeline` and Zod, so a sim file
// may import it (declared in package.json `automata.simEntries` and checked by `pnpm boundaries`).
export { type Ease, easeSchema, parseEase } from '../shared/timeline/ease.ts'
export type { Key } from '../shared/timeline/key.ts'
export { bracket, type Mix, mixNumber, sample, type Timed } from '../shared/timeline/sample.ts'
export { type Track, track } from '../shared/timeline/track.ts'
