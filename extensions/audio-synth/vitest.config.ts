import { defineTests } from '@automata/vitest-preset'

// audio-synth is presentation only: no sim entry and no golden, so there is no browser project.
export default defineTests({ optimizeDeps: ['@automata/sim', 'zod'], browsers: [], testTimeout: 90_000 })
