// The compiled Paraglide fixture is test scratch, so it must not sit inside `src/`: `svelte-package -i src` lists that
// folder during a build, and the fixture's teardown deleting a file it listed makes the build fail with ENOENT.
import { describe, expect, it } from 'vitest'
import { fixtureFolder } from '#src/features/locale/testing/compile-fixture.ts'

describe('fixtureFolder', () => {
  it('is under the package’s node_modules/.cache, outside src/', () => {
    const here = new URL('file:///repo/packages/automata/src/features/locale/testing/global-setup.ts')
    expect(fixtureFolder(here)).toBe('/repo/packages/automata/node_modules/.cache/af-paraglide-fixture')
  })
})
