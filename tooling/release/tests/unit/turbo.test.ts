import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'

// The workspace runs TypeScript sources, never built output (M2.4 spec §2), so only `build` waits for its
// dependencies' builds. If typecheck or the tests depended on `^build`, every `pnpm check` would build first.
const turbo = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../../../turbo.json', import.meta.url)), 'utf8'),
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
// The same holds for vendor/ruken: a build bundles the Ruken tarballs and write-vendored copies the commit and
// hashes from vendor/ruken/README.md, yet the lockfile key of a `file:` tarball (`@ruken/sdk@file:…`) stays the
// same when the tarball is repacked, so without this input a repack replays the previous Ruken's dist (QB.1f).
it("build's cache key covers the shared build code in tooling/release and the vendored Ruken tarballs", () => {
  expect(turbo.tasks.build?.inputs).toEqual([
    '$TURBO_DEFAULT$',
    '$TURBO_ROOT$/tooling/release/src/**',
    '$TURBO_ROOT$/vendor/ruken/**',
  ])
})

// write-vendored.test.ts hashes vendor/ruken's tarballs against its README and reads the installed copies of
// them, none of which is in this package, so without this input turbo would replay a pass after a repack.
it("this package's tests have the vendored Ruken tarballs in their cache key", () => {
  const own = JSON.parse(
    readFileSync(fileURLToPath(new URL('../../turbo.json', import.meta.url)), 'utf8'),
  ) as typeof turbo
  expect(own.tasks['test:unit']?.inputs).toContain('$TURBO_ROOT$/vendor/ruken/**')
  expect(own.tasks.test?.inputs).toContain('$TURBO_ROOT$/vendor/ruken/**')
})
