import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { checkSources, type Manifest } from '#src/sources-md.ts'

// Where the two builders' code came from is recorded in docs/provenance/sources.md: a section for each with the full
// commit and how to pull again, then one row per source file saying where it went ("ported", "rewritten: what" or
// "left out: why"). The manifest lists every file at those commits, so a file with no row is found, not forgotten.

const SHA = 'a'.repeat(40)
const manifest: Manifest = {
  figure: { commit: SHA, files: ['src/a.ts', 'src/b.ts'] },
  environment: { commit: SHA, files: ['src/c.ts'] },
}
const PULL = 'Pull again: `git diff <recorded>..<new> -- <the rows’ source paths>`, then port each hunk.'
const section = (title: string, rows: string[], commit = SHA, pull = PULL) =>
  [
    `## ${title}`,
    `Repository: \`example/repo\`. Commit: \`${commit}\`. Licence: none recorded.`,
    pull,
    '',
    ...rows,
    '',
  ].join('\n')
const doc = (figure: string[], environment: string[], extra: { commit?: string; pull?: string } = {}) =>
  [
    section('The figure source', figure, extra.commit, extra.pull),
    section('The environment source', environment),
  ].join('\n')
const row = (source: string, af: string, how: string) => `| \`${source}\` | ${af} | ${how} |`

describe('checkSources', () => {
  it('each builder section names a 40-character commit and the pull procedure', () => {
    expect(checkSources(doc([], []), manifest)).toEqual([])
    expect(checkSources(doc([], [], { commit: 'abc123' }), manifest)).toEqual([
      'The figure source: no 40-character commit',
    ])
    expect(checkSources(doc([], [], { pull: '' }), manifest)).toEqual([
      'The figure source: no pull procedure (a `git diff` line)',
    ])
    expect(checkSources('# nothing\n', manifest)).toEqual([
      'The figure source: section missing',
      'The environment source: section missing',
    ])
  })

  it('names the commit in the manifest, so the two cannot drift', () => {
    const other: Manifest = { ...manifest, figure: { ...manifest.figure, commit: 'b'.repeat(40) } }
    expect(checkSources(doc([], []), other)).toEqual([
      `The figure source: commit ${SHA} is not the manifest's (${'b'.repeat(40)})`,
    ])
  })

  it("every row's AF path exists or says left out", () => {
    const rows = [
      row('src/a.ts', '`packages/3d/src/a.ts`', 'ported'),
      row('src/b.ts', '`packages/3d/src/gone.ts`', 'rewritten: the gait as data'),
    ]
    const exists = (path: string) => path === 'packages/3d/src/a.ts'
    expect(checkSources(doc(rows, []), manifest, { exists })).toEqual([
      'The figure source: `src/b.ts` goes to `packages/3d/src/gone.ts`, which does not exist',
    ])
    const out = [row('src/a.ts', 'none', 'left out: a tuning aid for the builder’s own swatches')]
    expect(checkSources(doc(out, []), manifest, { exists })).toEqual([])
    expect(checkSources(doc([row('src/a.ts', 'none', 'ported')], []), manifest, { exists })).toEqual([
      'The figure source: `src/a.ts` is ported but names no AF file',
    ])
  })

  it('a row may follow its source path with a note on which names of the file it covers', () => {
    const rows = [`| \`src/c.ts\` (\`quad\`, \`box\`) | \`packages/3d/src/c.ts\` | ported: as written |`]
    expect(checkSources(doc([], rows), manifest, { complete: false })).toEqual([])
    expect(
      checkSources(
        doc([row('src/a.ts', '`x.ts`', 'ported'), row('src/b.ts', '`y.ts`', 'ported')], rows),
        manifest,
        {
          complete: true,
        },
      ),
    ).toEqual([])
  })
  it('refuses a row whose source file is not in the manifest, or whose way is not one of the three', () => {
    const rows = [row('src/zzz.ts', '`x.ts`', 'ported'), row('src/a.ts', '`x.ts`', 'copied')]
    expect(checkSources(doc(rows, []), manifest)).toEqual([
      'The figure source: `src/zzz.ts` is not a file of the manifest',
      'The figure source: `src/a.ts` says "copied": use ported, rewritten: what, or left out: why',
    ])
  })

  it('with complete, every manifest file has a row', () => {
    const rows = [row('src/a.ts', '`x.ts`', 'ported')]
    expect(checkSources(doc(rows, []), manifest)).toEqual([])
    expect(checkSources(doc(rows, []), manifest, { complete: true })).toEqual([
      'The figure source: `src/b.ts` has no row',
      'The environment source: `src/c.ts` has no row',
    ])
  })

  it('reads the real record: sections, commit and manifest agree', () => {
    const root = fileURLToPath(new URL('../../../..', import.meta.url))
    const md = readFileSync(join(root, 'docs/provenance/sources.md'), 'utf8')
    const real = JSON.parse(
      readFileSync(join(root, 'docs/provenance/builders-manifest.json'), 'utf8'),
    ) as Manifest
    const exists = (path: string) => existsSync(join(root, path))
    expect(checkSources(md, real, { exists })).toEqual([])
    expect(real.figure.files.length).toBeGreaterThan(100)
    expect(real.environment.files.length).toBeGreaterThan(100)
  })
})
