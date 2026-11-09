// A fake `OfflineAudioContext` for the render module's tests: the recording context plus `startRendering`, which returns silence of
// the length it was built for. Node has no Web Audio; the real render runs in Chromium (the browser runner's test).
import { type FakeContext, fakeContext } from './fake-audio'

export interface FakeOffline {
  readonly channels: number
  readonly frames: number
  readonly rate: number
  readonly ctx: FakeContext & Record<string, unknown>
}

/** A `make` function for the render module, remembering every context it built. */
export function fakeOffline(): {
  make: (channels: number, frames: number, rate: number) => never
  built: FakeOffline[]
} {
  const built: FakeOffline[] = []
  return {
    built,
    make(channels, frames, rate) {
      const ctx = fakeContext(rate)
      Object.assign(ctx, {
        startRendering: async () => ({
          getChannelData: () => new Float32Array(frames),
        }),
      })
      built.push({ channels, frames, rate, ctx })
      return ctx as never
    },
  }
}
