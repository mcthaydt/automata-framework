// The lit gate's pictures (docs/refactor/c8/gate-lit/): the base interior at `lampLit` and its exterior by day, the base pair standing
// and walking, unlit (today) and lit, written by `scripts/gate.ts lit` (which sets VITE_C8_GATE and C7_GATE_OUT); skipped in every
// other run. The same file under `tests/browser/webgpu/` draws them on WebGPU.
import { describe, expect, it } from 'vitest'
import { writeGateLit } from '../../fixtures/gate-lit-write.ts'

const on = import.meta.env.VITE_C8_GATE === '1'
const hasWebGL2 = document.createElement('canvas').getContext('webgl2') !== null

describe.runIf(on && hasWebGL2)('the c8 gate: a lit room on WebGL', () => {
  it('draws the interior and the exterior, unlit and lit, and writes the pictures', async () => {
    const drawn = await writeGateLit('')
    expect(drawn).toBe('webgl')
  }, 300_000)
})
