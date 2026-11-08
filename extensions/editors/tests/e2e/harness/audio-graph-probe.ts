// What a played game asked its Web Audio graph to do, read the way a person's ears would: not what the stage says it
// played, but the levels the browser was told to set. `recordAudioParams` goes into the page before the game loads (as an
// init script); `heardParams` reads back every level set on an audio parameter since.
import type { Page } from '@playwright/test'

export interface HeardParam {
  /** How the level was set: `value` (a level held), a `setTargetAtTime` glide (a duck), or a ramp. */
  readonly how: string
  readonly level: number
}

/** Runs in the page: wraps the `AudioParam` setters so that every level set is written down. */
export function recordAudioParams(): void {
  const heard: { how: string; level: number }[] = []
  ;(globalThis as unknown as { __heardParams: typeof heard }).__heardParams = heard
  const proto = AudioParam.prototype
  const value = Object.getOwnPropertyDescriptor(proto, 'value')
  if (value?.set !== undefined) {
    const set = value.set
    Object.defineProperty(proto, 'value', {
      ...value,
      set(this: AudioParam, level: number) {
        heard.push({ how: 'value', level })
        set.call(this, level)
      },
    })
  }
  for (const how of ['setTargetAtTime', 'linearRampToValueAtTime', 'setValueAtTime'] as const) {
    const original = proto[how] as (this: AudioParam, level: number, ...rest: number[]) => AudioParam
    proto[how] = function (this: AudioParam, level: number, ...rest: number[]) {
      heard.push({ how, level })
      return original.call(this, level, ...rest)
    } as never
  }
}

export const heardParams = (page: Page): Promise<HeardParam[]> =>
  page.evaluate(() => [...(globalThis as unknown as { __heardParams: HeardParam[] }).__heardParams])
