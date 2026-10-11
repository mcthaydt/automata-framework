import { defineConfig } from 'tsdown'

// The published build (M2.4 spec §3.2). The workspace keeps running `src`; only the tarball uses `dist`.
// `dependencies` (koota, zod) stay external; isolatedDeclarations lets tsdown write the `.d.ts` without tsc.
export default defineConfig({
  entry: { index: 'src/index.ts', hash: 'src/hash/hash.ts', math: 'src/math/dmath.ts' },
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  dts: { eager: true },
})
