import { describe, expect, it } from 'vitest'
import { hudLabelHooks } from '../../../stress/hud-labels.ts'

const frame = { alpha: 1, frameMs: 16, paused: false }

/** A stand-in for the framework's hud text that records every `set`. */
function recorder() {
  const sets: string[][] = [[]]
  let made = 0
  const createText = () => ({
    ready: Promise.resolve(),
    destroy: () => {},
    label: () => {
      made++
      return {
        kind: 'bitmap' as const,
        set: (value: string) => {
          sets.at(-1)?.push(value)
          return { width: 1, height: 1 }
        },
        hide: () => {},
        destroy: () => {},
      }
    },
  })
  return { createText, sets, made: () => made, nextFrame: () => sets.push([]) }
}

describe('hudLabelHooks', () => {
  it('makes the labels once and changes every one of them each frame', () => {
    const r = recorder()
    const hooks = hudLabelHooks(10, r.createText as never)({} as never)
    hooks.draw?.(frame)
    r.nextFrame()
    hooks.draw?.({ ...frame, frameMs: 33 })
    expect(r.made()).toBe(10)
    expect(r.sets[0]).toHaveLength(10)
    expect(r.sets[1]).toHaveLength(10)
    expect(r.sets[1]?.some((text, i) => text !== r.sets[0]?.[i])).toBe(true)
    expect(new Set(r.sets[0]).size).toBe(10)
  })
})
