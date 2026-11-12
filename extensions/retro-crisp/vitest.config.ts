import { defineTests } from '@automataframework/vitest-preset'

// `tests/unit`: the profile, the maths and the uniforms, on Node. `tests/browser`: the pass on a real WebGL2 context.
// The passes draw on a real WebGL2 context in Chromium; WebKit and WebGPU parity are the GPU runner's.
export default defineTests({ svelte: true, optimizeDeps: ['zod'], browsers: ['chromium'] })
