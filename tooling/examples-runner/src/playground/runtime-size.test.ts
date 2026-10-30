import { gzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { checkRuntimeSize, RUNTIME_GZIP_BUDGET } from './runtime-size.ts'

describe('checkRuntimeSize', () => {
  const text = (length: number) => new TextEncoder().encode('x'.repeat(length))

  it("sums the gzip bytes of the runtime's JavaScript, nothing else", () => {
    const js = text(5000)
    const result = checkRuntimeSize(
      [
        { path: 'runtime/assets/a.js', bytes: js },
        { path: 'runtime/assets/a.css', bytes: text(9000) },
      ],
      RUNTIME_GZIP_BUDGET,
    )
    expect(result).toEqual({
      gzipBytes: gzipSync(js, { level: 9 }).length,
      budget: RUNTIME_GZIP_BUDGET,
      ok: true,
    })
  })

  it('fails one byte over the budget', () => {
    const js = text(5000)
    const size = gzipSync(js, { level: 9 }).length
    expect(checkRuntimeSize([{ path: 'runtime/a.js', bytes: js }], size).ok).toBe(true)
    expect(checkRuntimeSize([{ path: 'runtime/a.js', bytes: js }], size - 1).ok).toBe(false)
  })

  it('is the spec budget of 460 kB gzip', () => {
    expect(RUNTIME_GZIP_BUDGET).toBe(460_000)
  })
})
