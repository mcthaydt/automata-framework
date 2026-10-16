import { configDefaults, defineConfig } from 'vitest/config'

// `*.slow.test.ts` drives real Chromium (the `csp` step's probe). It is left out of `test`/`test:unit`, which
// run in the hosted unit job without browsers, and runs with `test:slow` (vitest.slow.config.ts).
export default defineConfig({
  test: { exclude: [...configDefaults.exclude, '**/*.slow.test.ts'] },
})
