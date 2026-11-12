import { defineTests } from '@automataframework/vitest-preset'

// audio-synth is presentation only: no sim entry and no golden, so there is no browser project. `svelte` because the stage
// test imports `fakeClock` from `@automataframework/framework/testing`, whose barrel also holds Svelte fixtures.
export default defineTests({ optimizeDeps: ['@automataframework/sim', 'zod'], browsers: [], svelte: true })
