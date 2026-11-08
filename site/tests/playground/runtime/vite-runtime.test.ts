// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { PLAYGROUND_ENTRIES, runtimeFromViteManifest } from '../../../playground/src/vite-runtime.ts'

const manifest = {
  [PLAYGROUND_ENTRIES.automata]: {
    file: 'assets/automata-LRkvFZ12.js',
    isEntry: true,
    imports: ['_src-Dr7noOlv.js'],
    css: ['assets/automata-CBKxHYFl.css'],
  },
  [PLAYGROUND_ENTRIES.zod]: { file: 'assets/zod-CSYgToI_.js', isEntry: true },
  [PLAYGROUND_ENTRIES.noEval]: { file: 'assets/no-eval-Q1w2e3R4.js', isEntry: true },
  [PLAYGROUND_ENTRIES.frame]: {
    file: 'assets/frame-DCEneEhm.js',
    isEntry: true,
    imports: ['_src-Dr7noOlv.js'],
  },
  '_src-Dr7noOlv.js': {
    file: 'assets/src-Dr7noOlv.js',
    css: ['assets/src-BzoNNZTi.css'],
    imports: ['_src-Dr7noOlv.js'],
  },
}

describe('runtimeFromViteManifest', () => {
  it('names the three entries and every stylesheet the frame and the umbrella pull in, once each', () => {
    expect(runtimeFromViteManifest(manifest, '/playground/runtime/')).toEqual({
      automata: '/playground/runtime/assets/automata-LRkvFZ12.js',
      zod: '/playground/runtime/assets/zod-CSYgToI_.js',
      noEval: '/playground/runtime/assets/no-eval-Q1w2e3R4.js',
      frame: '/playground/runtime/assets/frame-DCEneEhm.js',
      styles: [
        '/playground/runtime/assets/automata-CBKxHYFl.css',
        '/playground/runtime/assets/src-BzoNNZTi.css',
      ],
    })
  })

  it('refuses a build that lacks an entry', () => {
    const { [PLAYGROUND_ENTRIES.zod]: _zod, ...rest } = manifest
    expect(() => runtimeFromViteManifest(rest, '/playground/runtime/')).toThrow(/zod/)
  })
})
