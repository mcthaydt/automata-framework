import { expect, test } from 'vitest'
import { server, userEvent } from 'vitest/browser'
import { createAudio } from '#src/features/audio/audio.manager.ts'
import { type AudioContextLike, AudioGraph } from '#src/features/audio/audio-graph.ts'
import { createPresentationBus } from '#src/shared/runtime/presentation/presentation-bus.manager.ts'
import { withHostingTest } from '#src/testing/host/page/ruken/hosting-test.ts'

// The Audio service on each engine's real Web Audio (M5.3 plan step 9), in Chromium, WebKit and Firefox: the
// unlock on a real gesture, and the graph's levels rendered offline, where the samples can be read.
//
// The live unlock runs in Chromium only: the Linux container these run in has no audio device, so WebKit rejects
// `resume()` ("Failed to start the audio device") and Firefox's never settles (probed 2026-10-17). The offline
// render needs no device and runs everywhere; sound on a real iPhone is an Owner gate (M5 spec §13).
test.runIf(server.browser === 'chromium')(
  'a real AudioContext unlocks on the first gesture after ready and closes when disposed',
  async () => {
    const contexts: AudioContext[] = []
    await withHostingTest(async ({ hosting }) => {
      await hosting.ready
      const bus = createPresentationBus()
      const unlockedFacts: unknown[] = []
      bus.subscribe('audio.unlocked', (fact) => unlockedFacts.push(fact))
      const audio = createAudio({
        hosting,
        bus,
        assets: { get: () => undefined },
        createContext: () => {
          const context = new AudioContext()
          contexts.push(context)
          return context
        },
      })
      expect(contexts).toEqual([])

      await userEvent.click(document.body)
      await waitFor(() => audio.unlocked.get())
      expect(contexts.map((context) => context.state)).toEqual(['running'])
      expect(unlockedFacts).toEqual([{}])

      audio.dispose()
      bus.dispose()
      await waitFor(() => contexts[0]?.state === 'closed')
    })
  },
)

test('the master is the player level times the host gain, and a duck takes its bus down and back', async () => {
  const seconds = 1.2
  const rate = 8000
  const offline = new OfflineAudioContext(1, seconds * rate, rate)
  const graph = new AudioGraph()
  graph.setGain('master', 0.5)
  graph.setHostGain(0.8)
  // OfflineAudioContext has no close and a different suspend; the graph uses neither while building or ducking.
  graph.buildIfNeeded(() => offline as unknown as AudioContextLike)
  const tone = offline.createConstantSource()
  tone.connect(graph.input('sfx') as AudioNode)
  tone.start(0)
  graph.duck('sfx', 0.75, 0.5)

  const samples = (await offline.startRendering()).getChannelData(0)
  const at = (time: number) => samples[Math.round(time * rate)] ?? Number.NaN

  // 0.5 × 0.8 = 0.4, ducked to a quarter of it until 0.5 s, then back up within the release.
  expect(at(0.2)).toBeCloseTo(0.1, 3)
  expect(at(0.45)).toBeCloseTo(0.1, 3)
  expect(at(1.1)).toBeCloseTo(0.4, 3)
})

/** Polls `done` each frame for up to five seconds. */
async function waitFor(done: () => boolean): Promise<void> {
  const until = performance.now() + 5000
  while (!done()) {
    if (performance.now() > until) throw new Error('timed out waiting')
    await new Promise((resolve) => requestAnimationFrame(resolve))
  }
}
