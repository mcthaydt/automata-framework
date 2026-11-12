import { defineTests } from '@automataframework/vitest-preset'

export default defineTests({
  optimizeDeps: ['@automataframework/sim', 'zod'],
})
