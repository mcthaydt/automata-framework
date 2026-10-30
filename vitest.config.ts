import { defineConfig } from 'vitest/config'

// The root project runs the workspace's own tooling tests. .core/af is a whole framework checkout with its own
// tests, so the include list is explicit rather than vitest's default glob.
export default defineConfig({
  test: { include: ['tooling/**/*.test.ts'] },
})
