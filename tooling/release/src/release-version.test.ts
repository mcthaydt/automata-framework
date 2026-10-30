import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'

// `pnpm release:version` is the release workflow's version script: changesets/action runs it on `main` and commits
// what it leaves changed as the Version packages pull request (release-packages.yml, `version` job). A bump changes
// more than each package.json and changelog: the sim's SIM_VERSION, the API reference's version (tooling/api-index
// renders it from the packages' package.json) and the agent plugin, whose `reference/api.md` must be that reference
// and whose `plugin.json` version must be its version (`pnpm agent-skills`). PR #31 needed the last two by hand.
// So the script builds (the API index reads the emitted .d.ts), runs the API index with `pnpm cheatsheet` (its
// --write-cheatsheet mode, tooling/api-index/src/ci.test.ts, which also rewrites the cheatsheet if it is stale),
// and only then writes the skill's copy and the plugin version.
const scripts = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../../package.json', import.meta.url)), 'utf8'),
).scripts as Record<string, string>

it('bumps, syncs SIM_VERSION, builds, runs the API index and cheatsheet, then writes the agent skills, in order', () => {
  expect(scripts['release:version']?.split(' && ')).toEqual([
    'changeset version',
    'node tooling/release/src/sync-versions.ts',
    'pnpm build',
    'pnpm cheatsheet',
    'pnpm agent-skills --write',
  ])
})
