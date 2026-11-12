import { defineTests } from '@automataframework/vitest-preset'

// Net has no browser tests: the wire, the room and the session are plain TypeScript, and the sim's hashes are checked in
// the units. `svelte` because the tests import `fakeClock` from `@automataframework/framework/testing`, whose barrel also holds
// Svelte fixtures. The link tests step a fake clock through hundreds of milliseconds, and the shared runner runs every
// package at once, so they get physics's margin rather than the 5 s default (a hang still fails).
export default defineTests({
  optimizeDeps: ['@automataframework/sim', 'zod'],
  browsers: [],
  svelte: true,
})
