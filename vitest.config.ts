import { defineConfig } from 'vitest/config'

// The root project runs the workspace's own tooling tests. .core/af is a whole framework checkout with its own
// tests, so the include list is explicit rather than vitest's default glob. A workspace package under tooling/
// (pipelines) runs its own tests through `pnpm -r test:unit`, so it is left out here rather than run twice.
export default defineConfig({
  test: { include: ['tooling/**/*.test.ts'], exclude: ['tooling/pipelines/**', '**/node_modules/**'] },
})
