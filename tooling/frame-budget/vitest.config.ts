import { defineTests } from '@automataframework/vitest-preset'

// The stress example is a game, so its tests build Svelte views; every test runs on Node.
export default defineTests({ svelte: true, browsers: [] })
