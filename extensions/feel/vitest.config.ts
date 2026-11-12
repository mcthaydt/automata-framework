import { defineTests } from '@automataframework/vitest-preset'

// Feel is presentation only: no sim entry and no golden, so there is no browser project; the F-b test compares sim
// hashes itself. `svelte` because the clock test imports `fakeClock` from `@automataframework/framework/testing`, whose barrel
// also holds Svelte fixtures.
export default defineTests({
  optimizeDeps: ['@automataframework/sim', 'zod'],
  browsers: [],
  svelte: true,
})
