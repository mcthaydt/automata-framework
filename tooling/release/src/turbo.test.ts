import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'

// The workspace runs TypeScript sources, never built output (M2.4 spec §2), so only `build` waits for its
// dependencies' builds. If typecheck or the tests depended on `^build`, every `pnpm check` would build first.
const turbo = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../../turbo.json', import.meta.url)), 'utf8'),
) as {
  tasks: Record<string, { dependsOn?: string[]; inputs?: string[] }>
}

it('only build depends on ^build', () => {
  const dependOnBuild = Object.entries(turbo.tasks)
    .filter(([, task]) => task.dependsOn?.includes('^build'))
    .map(([name]) => name)
  expect(dependOnBuild).toEqual(['build'])
})

// Every package's build runs code from tooling/release (tsdown-shared, finish-svelte-dist, write-vendored), which
// is outside the package, so turbo would replay a stale dist after that code changes unless it is an input.
it("build's cache key covers the shared build code in tooling/release", () => {
  expect(turbo.tasks.build?.inputs).toEqual(['$TURBO_DEFAULT$', '$TURBO_ROOT$/tooling/release/src/**'])
})
