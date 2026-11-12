import { defineConfig, configDefaults } from 'vitest/config';

// The workflow worktrees under .claude/ hold whole copies of the repo; their tests are theirs. A test that paints a
// figure in every view and its walk takes a second or two alone, and several times that with the suite's files run side
// by side, so the default 5 s limit is raised to keep a slow machine from failing a sound render.
export default defineConfig({ test: { exclude: [...configDefaults.exclude, '.claude/**'], testTimeout: 30_000 } });
