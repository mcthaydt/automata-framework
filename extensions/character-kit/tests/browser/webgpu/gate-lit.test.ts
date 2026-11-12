// The lit gate's pictures on WebGPU (docs/refactor/c8/gate-lit/, the `-webgpu` files): written by `scripts/gate.ts lit`; skipped in every
// other run and where the browser grants no adapter.
import { describe, expect, it } from 'vitest'
import { writeGateLit } from '../../fixtures/gate-lit-write.ts'

const on = import.meta.env.VITE_C8_GATE === '1'

describe.runIf(on)('the c8 gate: a lit room on WebGPU', () => {
  it('draws the interior and the exterior, unlit and lit, and writes the pictures', async (context) => {
    const drawn = await writeGateLit('-webgpu', 'webgpu')
    if (drawn !== 'webgpu')
      context.skip('This browser grants no WebGPU adapter, so the renderer fell back to WebGL.')
    expect(drawn).toBe('webgpu')
  }, 300_000)
})
