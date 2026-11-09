import { defineTests } from '@automataframework/vitest-preset'

// The smoke test boots the demo in Chromium (examples convention: boots, ready, no console errors). The demo is a
// Svelte page, so the preset compiles Svelte and resolves its client build. There are no unit tests.
export default defineTests({ svelte: true, browsers: ['chromium'] })
