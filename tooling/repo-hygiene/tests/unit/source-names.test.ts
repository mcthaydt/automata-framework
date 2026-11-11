import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { findSourceNames, SOURCE_NAMES } from '#src/source-names.ts'

// FR.4: AF is standalone, so the text it publishes (the changelogs and package READMEs the website mirrors, the root README, the agent
// skills) never names the projects its code was first proven in; where code came from is recorded only in docs/provenance/sources.md.
// The check reports file and line and which entry matched, never the name itself, so a failure does not print it into a log.

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

  it('does not withhold the title of the 3D reference game, and still catches the other sources', () => {
    // Since 2026-11-11 The Last Light is the framework's own game, so its title is free to print; its old repository's
    // name and the other source projects stay withheld.
    const title = tree({
      'packages/a/CHANGELOG.md': 'see The Last Light, the_last_light and the-last-light\n',
    })
    expect(findSourceNames(title)).toEqual([])
    const oldRepository = tree({ 'packages/a/CHANGELOG.md': 'from PixiJS3D_Experiment_001\n' })
    expect(findSourceNames(oldRepository)).toHaveLength(1)
    expect(SOURCE_NAMES.map((entry) => entry.sample)).not.toContain('The Last Light')
  })

  it('leaves text that is not a published surface alone (provenance, plans, source comments)', () => {
    const sample = SOURCE_NAMES[0]?.sample ?? ''
    const root = tree({
      'docs/provenance/sources.md': `${sample}\n`,
      'docs/archive/superpowers/plans/x.md': `${sample}\n`,
      'docs/superpowers/plans/x.md': `${sample}\n`,
      'packages/ui/src/a.ts': `// ${sample}\n`,
      'packages/ui/CHANGELOG.md': 'clean\n',
    })
    expect(findSourceNames(root)).toEqual([])
  })
})

describe('the repository', () => {
  it('names no source project in its changelogs, package READMEs, root README or agent skills', () => {
    const root = fileURLToPath(new URL('../../../..', import.meta.url))
    expect(findSourceNames(root)).toEqual([])
  })
})

describe('findSourceNames with code folders', () => {
  const sample = SOURCE_NAMES[0]?.sample ?? ''
  const code = { code: ['packages/3d'] }

  it('a .ts file naming a source under a code folder fails', () => {
    const root = tree({ 'packages/3d/src/a.ts': `// fine\n// ported from ${sample}\n` })
    expect(findSourceNames(root, code)).toEqual(['packages/3d/src/a.ts:2: names a source project (entry 1)'])
  })

  it('reads .svelte, .css, .json and .toml files too, tests and fixtures among them', () => {
    const root = tree({
      'packages/3d/src/a.svelte': `<!-- ${sample} -->\n`,
      'packages/3d/src/a.css': `/* ${sample} */\n`,
      'packages/3d/tests/fixtures/a.json': `{ "from": "${sample}" }\n`,
      'packages/3d/tests/fixtures/a.toml': `# ${sample}\n`,
    })
    expect(findSourceNames(root, code)).toHaveLength(4)
  })

  it('one outside the code folders does not', () => {
    const root = tree({ 'packages/ui/src/a.ts': `// ${sample}\n`, 'packages/3d/src/b.ts': '// clean\n' })
    expect(findSourceNames(root, code)).toEqual([])
  })

  it('a file whose name names a source is a finding at line 0', () => {
    const root = tree({ [`packages/3d/src/${sample.toLowerCase().replace(/[\s_]/g, '-')}.ts`]: '// clean\n' })
    expect(findSourceNames(root, code)).toEqual([
      `packages/3d/src/${sample.toLowerCase().replace(/[\s_]/g, '-')}.ts:0: names a source project (entry 1)`,
    ])
  })

  it('skips node_modules, dist and .svelte-kit (generated)', () => {
    const root = tree({
      'packages/3d/node_modules/x/a.ts': `// ${sample}\n`,
      'packages/3d/dist/a.json': `"${sample}"\n`,
      'packages/3d/.svelte-kit/__package__/a.d.ts': `// ${sample}\n`,
    })
    expect(findSourceNames(root, code)).toEqual([])
  })

  it('docs/provenance stays exempt', () => {
    const root = tree({ 'docs/provenance/sources.md': `${sample}\n`, 'packages/3d/src/a.ts': '// clean\n' })
    expect(findSourceNames(root, code)).toEqual([])
  })

  it('learns the environment builder’s name', () => {
    const root = tree({ 'packages/3d/src/a.ts': '// Environment Builder\n' })
    expect(findSourceNames(root, code)).toHaveLength(1)
  })
})
