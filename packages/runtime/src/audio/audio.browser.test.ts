import { Hosting } from '@mcthaydt/automata-host'
import { HostingTest, runScoped } from '@mcthaydt/automata-host/testing'
import { Effect, Exit, Scope, SubscriptionRef } from 'effect'
import { expect, test } from 'vitest'
import { server, userEvent } from 'vitest/browser'
import { makePresentationBus } from '../presentation/presentation-bus.manager.js'
import { makeAudio } from './audio.manager.js'
import { type AudioContextLike, AudioGraph } from './audio-graph.js'

// The Audio service on each engine's real Web Audio (M5.3 plan step 9), in Chromium, WebKit and Firefox: the
// unlock on a real gesture, and the graph's levels rendered offline, where the samples can be read.
//
// The live unlock runs in Chromium only: the Linux container these run in has no audio device, so WebKit rejects
// `resume()` ("Failed to start the audio device") and Firefox's never settles (probed 2026-10-17). The offline
// render needs no device and runs everywhere; sound on a real iPhone is an Owner gate (M5 spec §13).
test.runIf(server.browser === 'chromium')(
  'a real AudioContext unlocks on the first gesture after ready and closes with the scope',
  async () => {
    const contexts: AudioContext[] = []
    await runScoped(
      Effect.gen(function* () {
        const hosting = yield* Hosting
        yield* hosting.ready
        const bus = yield* makePresentationBus()
        const unlockedFacts: unknown[] = []
        bus.subscribe('audio.unlocked', (fact) => unlockedFacts.push(fact))
        const scope = yield* Scope.make()
        const audio = yield* makeAudio({
          hosting,
          bus,
          assets: { get: () => undefined },
          createContext: () => {
            const context = new AudioContext()
            contexts.push(context)
            return context
          },
        }).pipe(Scope.extend(scope))
        expect(contexts).toEqual([])

        yield* Effect.promise(() => userEvent.click(document.body))
        yield* Effect.promise(() => waitFor(() => SubscriptionRef.get(audio.unlocked).pipe(Effect.runSync)))
        expect(contexts.map((context) => context.state)).toEqual(['running'])
        expect(unlockedFacts).toEqual([{}])

        yield* Scope.close(scope, Exit.void)
        yield* Effect.promise(() => waitFor(() => contexts[0]?.state === 'closed'))
      }).pipe(Effect.provide(HostingTest())),
    )
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
