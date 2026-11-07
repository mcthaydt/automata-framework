import { defineTests } from '@automata/vitest-preset'

// The Colyseus suite boots a real server and real sockets per test; the shared Mac runner runs every package's tests
// at once, so it gets net's margin rather than the 5 s default (a hang still fails). `svelte` because the link tests
// import `fakeClock` from `@automata/framework/testing`, whose barrel also holds Svelte fixtures.
export default defineTests({
  optimizeDeps: ['@automata/sim', 'zod'],
  browsers: [],
  svelte: true,
  testTimeout: 90_000,
})
