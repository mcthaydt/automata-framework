import { defineTests } from '@automata/vitest-preset'

// audio-synth is presentation only: no sim entry and no golden, so there is no browser project. `svelte` because the stage
// test imports `fakeClock` from `@automata/framework/testing`, whose barrel also holds Svelte fixtures.
export default defineTests({ optimizeDeps: ['@automata/sim', 'zod'], browsers: [], svelte: true })
