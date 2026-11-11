import { defineTests } from '@automata/vitest-preset'

export default defineTests({
  optimizeDeps: ['@automata/sim', 'zod'],
})
