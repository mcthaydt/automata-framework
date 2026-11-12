import { describe, expect, it } from 'vitest'
import { owningPackages } from '#src/staged-packages.ts'

// The commit hook runs the unit tests of the packages that own the staged files, and of nothing else. Turbo's own
// `[HEAD]` filter cannot do that: a change in a package the root workspace depends on (`@automata/tools` and what it
// pulls in) makes turbo select every package, so the hook maps the files itself.

const packages = [
  'packages/automata',
  'packages/sim',
  'packages/tools',
  'examples/2d',
  'examples/2d/content/hot-reload',
  'site',
]

describe('owningPackages', () => {
  it('names the package that holds a staged file', () => {
    expect(owningPackages(['packages/sim/src/entries/hash.ts'], packages)).toEqual(['packages/sim'])
  })

  it('names each package once, in order, when several files in several packages are staged', () => {
    const files = [
      'packages/tools/src/a.ts',
      'packages/automata/README.md',
      'packages/tools/tests/unit/a.test.ts',
      'site/src/routes/+page.svelte',
    ]
    expect(owningPackages(files, packages)).toEqual(['packages/automata', 'packages/tools', 'site'])
  })

  it('names nothing for files outside every package: the root files, the docs, the hook itself', () => {
    expect(
      owningPackages(
        ['package.json', 'lefthook.yml', 'docs/refactor/progress.md', '.changeset/a.md'],
        packages,
      ),
    ).toEqual([])
  })

  it('names nothing when no file is staged', () => {
    expect(owningPackages([], packages)).toEqual([])
  })

  it('gives a file in a nested package to the nested one, not the package around it', () => {
    expect(
      owningPackages(['examples/2d/content/hot-reload/src/a.ts', 'examples/2d/src/b.ts'], packages),
    ).toEqual(['examples/2d', 'examples/2d/content/hot-reload'])
  })

  it('does not give a file to a package whose folder name only starts the same', () => {
    expect(owningPackages(['packages/sim-extra/src/a.ts', 'packages/simulator.md'], packages)).toEqual([])
  })
})
