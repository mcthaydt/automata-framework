import { defineTests } from '@automata/vitest-preset'

// `tests/unit`: the kit's registrations, dresser, lettering, library and maps, on Node.
export default defineTests({ optimizeDeps: ['zod'] })
