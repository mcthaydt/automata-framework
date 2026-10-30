import { loadTextures } from 'pixi.js'
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

  // Pixi checks ImageBitmap support in a Blob worker that fetches a data: URL; Ruken's connect-src refuses it, and
  // WebKit and Firefox report the violation (website playground A-17). Textures load on the main thread instead.
  it('loads textures without the worker probe', async () => {
    await import('./no-eval.js')
    expect(loadTextures.config.preferWorkers).toBe(false)
  })
})
