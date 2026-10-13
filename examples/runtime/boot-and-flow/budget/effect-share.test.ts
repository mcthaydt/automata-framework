import { existsSync, readFileSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { gzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import {
  checkEffectShare,
  computeEffectShare,
  EFFECT_BUDGET_BYTES,
  effectSharePlugin,
} from './effect-share.ts'

describe('budget/effect-share', () => {
  it('sums only modules whose id contains /node_modules/effect/ or effect@3.22.2 and gzips their rendered code', () => {
    const effectCode1 = 'export const core = 1;\n'
    const effectCode2 = 'export const fiber = 2;\n'
    const nonEffectCode = 'export const other = 3;\n'

    const fakeBundle = {
      'index.js': {
        type: 'chunk',
        modules: {
          '/node_modules/effect/dist/esm/core.js': {
            code: effectCode1,
          },
          '/node_modules/.pnpm/effect@3.22.2/node_modules/effect/dist/esm/fiber.js': {
            code: effectCode2,
          },
          '/node_modules/koota/dist/index.js': {
            code: nonEffectCode,
          },
          '/src/main.ts': {
            code: 'console.log("main");\n',
          },
        },
      },
    }

    const result = computeEffectShare(fakeBundle as unknown as Record<string, unknown>)
    expect(result.moduleCount).toBe(2)
    expect(result.modules).toEqual([
      '/node_modules/effect/dist/esm/core.js',
      '/node_modules/.pnpm/effect@3.22.2/node_modules/effect/dist/esm/fiber.js',
    ])

    const expectedCombined = effectCode1 + '\n' + effectCode2 + '\n'
    expect(result.rawBytes).toBe(expectedCombined.length)

    const expectedGzip = gzipSync(Buffer.from(expectedCombined, 'utf8'), { level: 9 }).length
    expect(result.gzipBytes).toBe(expectedGzip)
  })

  it('fails check when gzipBytes exceeds 35 000 bytes budget and passes when under', () => {
    expect(EFFECT_BUDGET_BYTES).toBe(35_000)

    const pass = checkEffectShare(34_999)
    expect(pass.ok).toBe(true)
    expect(pass.message).toContain('within budget')

    const exact = checkEffectShare(35_000)
    expect(exact.ok).toBe(true)

    const fail = checkEffectShare(35_001)
    expect(fail.ok).toBe(false)
    expect(fail.message).toContain('exceeds budget')
  })

  it('plugin writes effect-share.json during generateBundle', () => {
    const outDir = resolve(import.meta.dirname, 'test-dist')
    rmSync(outDir, { recursive: true, force: true })

    const plugin = effectSharePlugin({ outDir })
    expect(plugin.name).toBe('af-effect-share')

    const fakeBundle = {
      'index.js': {
        type: 'chunk',
        modules: {
          '/node_modules/effect/dist/esm/core.js': {
            code: 'export const a = 1;',
          },
        },
      },
    }

    const bundleHook = plugin.generateBundle
    if (typeof bundleHook === 'function') {
      bundleHook.call({} as never, {} as never, fakeBundle as never, false as never)
    }

    const jsonPath = resolve(outDir, 'effect-share.json')
    expect(existsSync(jsonPath)).toBe(true)

    const written = JSON.parse(readFileSync(jsonPath, 'utf8'))
    expect(written.budgetBytes).toBe(35_000)
    expect(written.moduleCount).toBe(1)
    expect(written.rawBytes).toBeGreaterThan(0)
    expect(written.gzipBytes).toBeGreaterThan(0)

    rmSync(outDir, { recursive: true, force: true })
  })
})
