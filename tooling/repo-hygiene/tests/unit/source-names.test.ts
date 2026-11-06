import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { findSourceNames, SOURCE_NAMES, STAGING_VM_PATH } from '#src/source-names.ts'

/** The first entry whose rewrite has landed, and one that has not (still allowed in code). */
const CLEAN_EVERYWHERE = SOURCE_NAMES.findIndex((entry) => entry.scope === 'everywhere')
const PUBLISHED_ONLY = SOURCE_NAMES.findIndex((entry) => entry.scope === 'published')

// FR.4: AF is standalone, so the text it publishes (the changelogs and package READMEs the website mirrors, the root README, the agent
// skills) never names the projects its code was first proven in; where code came from is recorded only in docs/provenance/sources.md.
// An entry whose rewrite has landed (`everywhere`) is also kept out of every code comment, test, fixture and script, so the name
// cannot creep back. The check reports file and line and which entry matched, never the name itself, so a failure does not print it
// into a log.

const folders: string[] = []
afterEach(() => {
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true })
})
function tree(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'af-source-names-'))
  folders.push(root)
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), text)
  }
  return root
}

describe('findSourceNames', () => {
  it('reports each name on a published surface by file, line and entry, without printing the name', () => {
    const sample = SOURCE_NAMES[0]?.sample ?? ''
    const root = tree({
      'packages/ui/CHANGELOG.md': `# ui\n\n- laid out as ${sample}'s\n`,
      'packages/ui/README.md': `a clean readme\n${sample}\n`,
      'README.md': 'clean\n',
      'agents/automata/skills/api/SKILL.md': `---\n---\n${sample}\n`,
    })
    const findings = findSourceNames(root)
    expect(findings).toEqual([
      'agents/automata/skills/api/SKILL.md:3: names a source project (entry 1)',
      'packages/ui/CHANGELOG.md:3: names a source project (entry 1)',
      'packages/ui/README.md:2: names a source project (entry 1)',
    ])
    for (const finding of findings) expect(finding.toLowerCase()).not.toContain(sample.toLowerCase())
  })

  it('catches every entry, in any letter case', () => {
    for (const [index, entry] of SOURCE_NAMES.entries()) {
      const root = tree({ 'packages/a/CHANGELOG.md': `x ${entry.sample.toUpperCase()} y\n` })
      expect(findSourceNames(root), `entry ${index + 1}`).toEqual([
        `packages/a/CHANGELOG.md:1: names a source project (entry ${index + 1})`,
      ])
    }
  })

  it('leaves text that is not a published surface alone while its entry is only published (provenance, plans, source comments)', () => {
    const sample = SOURCE_NAMES[PUBLISHED_ONLY]?.sample ?? ''
    const root = tree({
      'docs/provenance/sources.md': `${sample}\n`,
      'docs/archive/superpowers/plans/x.md': `${sample}\n`,
      'packages/ui/src/a.ts': `// ${sample}\n`,
      'packages/ui/CHANGELOG.md': 'clean\n',
    })
    expect(findSourceNames(root)).toEqual([])
  })
})

describe('findSourceNames in code', () => {
  const sample = SOURCE_NAMES[CLEAN_EVERYWHERE]?.sample ?? ''

  it('reports a name in a comment, a test, a fixture, a script and a game, by file, line and entry', () => {
    const root = tree({
      'packages/ui/src/a.ts': `// laid out as ${sample}'s\n`,
      'packages/ui/tests/unit/a.test.ts': `it('matches ${sample}', () => {})\n`,
      'packages/content/src/testing/fixtures/songs/x.toml': `displayName = "${sample} Tutorial"\n`,
      'packages/tools/deploy/bin/deploy': `#!/usr/bin/env bash\n# adapted from ${sample}\n`,
      'games/emberwick/ship.config.ts': `// ${sample} ruken-pack.ts\n`,
      'packages/ui/src/clean.ts': '// nothing to see\n',
    })
    const entry = CLEAN_EVERYWHERE + 1
    const findings = findSourceNames(root)
    expect(findings).toEqual([
      `games/emberwick/ship.config.ts:1: names a source project (entry ${entry})`,
      `packages/content/src/testing/fixtures/songs/x.toml:1: names a source project (entry ${entry})`,
      `packages/tools/deploy/bin/deploy:2: names a source project (entry ${entry})`,
      `packages/ui/src/a.ts:1: names a source project (entry ${entry})`,
      `packages/ui/tests/unit/a.test.ts:1: names a source project (entry ${entry})`,
    ])
    for (const finding of findings) expect(finding.toLowerCase()).not.toContain(sample.toLowerCase())
  })

  it('finds the name however it is cased or spaced', () => {
    const root = tree({ 'packages/ui/src/a.ts': `// ${sample.toUpperCase()}\n// ${sample.toLowerCase()}\n` })
    expect(findSourceNames(root)).toHaveLength(2)
  })

  it('leaves docs, installed packages, build output and binary files alone', () => {
    const root = tree({
      'docs/provenance/sources.md': `${sample}\n`,
      'packages/ui/node_modules/dep/index.js': `// ${sample}\n`,
      'packages/ui/dist/index.js': `// ${sample}\n`,
      'vendor/ruken/pack.tgz': `\0\0${sample}\0`,
    })
    expect(findSourceNames(root)).toEqual([])
  })

  it("allows only the staging VM's real path, which the live host still uses", () => {
    const root = tree({
      'packages/tools/deploy/bin/deploy': `caddy_env="\${SHIP_CADDY_ENV:-${STAGING_VM_PATH}caddy.env}"\n`,
      'packages/tools/deploy/README.md': `Run on ${STAGING_VM_PATH}caddy.env, then ${sample}.\n`,
    })
    expect(findSourceNames(root)).toEqual([
      `packages/tools/deploy/README.md:1: names a source project (entry ${CLEAN_EVERYWHERE + 1})`,
    ])
  })
})

describe('the repository', () => {
  it('names no source project on a published surface, and no finished entry anywhere in its code', () => {
    const root = fileURLToPath(new URL('../../../..', import.meta.url))
    expect(findSourceNames(root)).toEqual([])
  })
})
