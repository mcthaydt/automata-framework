// WGSL refuses an expression that mixes `*` and `^` (or `|`, `&`) at one level without parentheses, and a compile error there does not
// throw: the pass's pipeline is invalid and the frame goes black (found on WebGPU, `tests/browser/webgpu`). GLSL accepts it, so the
// WebGL2 cases never see it. This is the same check without a GPU, over the kit's shared WGSL.
import { describe, expect, it } from 'vitest'
import { HASH_WGSL, SURFACE_WGSL } from '#src/features/sky/shader-parts.ts'

/** The statements of `source` that apply `*`, `/` or `%` and `^`, `|` or `&` at the same parenthesis depth. */
function unparenthesised(source: string): string[] {
  return source.split('\n').filter((line) => {
    const seen = new Map<number, Set<string>>()
    let depth = 0
    for (const char of line) {
      if (char === '(') depth++
      else if (char === ')') depth--
      else if ('*/%'.includes(char)) seen.set(depth, (seen.get(depth) ?? new Set()).add('arithmetic'))
      else if ('^|&'.includes(char)) seen.set(depth, (seen.get(depth) ?? new Set()).add('bits'))
    }
    return [...seen.values()].some((kinds) => kinds.size > 1)
  })
}

describe('the kit’s shared WGSL', () => {
  it('detects a mixed expression', () => {
    expect(unparenthesised('var n = u32(a) * 3u ^ u32(b);')).toHaveLength(1)
    expect(unparenthesised('var n = (u32(a) * 3u) ^ u32(b);')).toHaveLength(0)
  })

  it('never mixes arithmetic and bit operators without parentheses', () => {
    expect(unparenthesised(HASH_WGSL)).toEqual([])
    expect(unparenthesised(SURFACE_WGSL)).toEqual([])
  })
})
