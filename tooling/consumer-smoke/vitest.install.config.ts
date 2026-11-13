import { defineConfig } from 'vitest/config'

// The desktop journey (tests/install/stranger-desktop.test.ts): packs, a fresh install, a cold Rust build and the app
// opened twice on a virtual screen. Linux only, with the Tauri toolchain and the tools `missingDesktopTools` names;
// run by hand or by the desktop job with `pnpm test:desktop`. Not silent: each step's time and the bundle sizes are
// the run's record.
export default defineConfig({
  test: {
    silent: false,
    include: ['tests/install/**/*.test.ts'],
    // About five minutes here (four of them the cold Rust build); the rest is headroom for a shared runner.
    testTimeout: 30 * 60_000,
    fileParallelism: false,
  },
})
