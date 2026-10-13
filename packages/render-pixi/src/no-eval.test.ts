import { describe, expect, it } from 'vitest'
import { config, z } from 'zod'

describe('render-pixi/no-eval', () => {
  it('enforces jitless mode in zod', async () => {
    await import('./no-eval.js')
    expect(config().jitless).toBe(true)
  })

  it('parses schemas without invoking new Function', async () => {
    await import('./no-eval.js')
    const realFunction = globalThis.Function
    try {
      globalThis.Function = new Proxy(realFunction, {
        construct() {
          throw new EvalError('blocked by CSP: unsafe-eval is not allowed')
        },
        apply() {
          throw new EvalError('blocked by CSP: unsafe-eval is not allowed')
        },
      })
      const schema = z.object({ x: z.number(), name: z.string() })
      const parsed = schema.parse({ x: 42, name: 'ember' })
      expect(parsed).toEqual({ x: 42, name: 'ember' })
    } finally {
      globalThis.Function = realFunction
    }
  })
})
