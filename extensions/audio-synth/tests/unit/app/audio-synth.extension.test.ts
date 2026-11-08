// The audio-synth extension (M6.10a): the content kind only, and no sim plugin (presentation never changes the sim, law 1).
import { expect, it } from 'vitest'
import { audioSynthExtension } from '#src/entries/index.ts'

it('registers the audio content kind and no sim plugin', () => {
  expect(audioSynthExtension.name).toBe('audio-synth')
  expect(audioSynthExtension.content?.map((k) => k.kind)).toEqual(['audio'])
  expect(audioSynthExtension.sim ?? []).toEqual([])
})
