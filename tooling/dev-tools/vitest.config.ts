import { defineTests } from '@automata/vitest-preset'

// The bin and integration tests start Node and real git; the shared Mac runner runs every package's tests at once, so
// they get the other packages' margin rather than the 5 s default. Every test runs on Node: no browser project.
export default defineTests({ browsers: [], testTimeout: 90_000 })
