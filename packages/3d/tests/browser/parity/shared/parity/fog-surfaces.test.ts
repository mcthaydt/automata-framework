// What a fog does to each kind of surface, against what `@pixi/3d` 0.1.0-beta.2 drew, on WebGL2. The scene and the recorded colours are
// `src/testing/fog-surfaces.ts`; the WebGPU twin is `tests/browser/webgpu/fog-surfaces.test.ts`.
import '#src/entries/no-eval.ts'
import { describe, expect, it } from 'vitest'
import { EXPECTED, FOG_NAMES, KINDS, rowMisses, shootFog } from '#src/testing/fog-surfaces.ts'

const hasWebGL2 = document.createElement('canvas').getContext('webgl2') !== null

describe.runIf(hasWebGL2)('fog, every surface kind, against beta.2', () => {
  for (const kind of KINDS)
    for (const name of FOG_NAMES)
      it(`${kind}, ${name === 'none' ? 'no fog' : `${name} fog`}: the colour at 6, 8, 10 and 14 m is beta.2's`, async () => {
        const seen = await shootFog(kind, name, 'webgl2')
        expect(rowMisses(`${kind} ${name}`, seen, EXPECTED[`${kind} ${name}`])).toEqual([])
      }, 60000)
})
