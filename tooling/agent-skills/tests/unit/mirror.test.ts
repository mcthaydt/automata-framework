import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readAgentPackage } from '#src/layout.ts'
import { MirrorError, mirrorMarketplace, writeMirror } from '#src/mirror.ts'
import { diffSkillTrees, listSkillTree } from '#src/skill-tree.ts'
// The relative cross-tooling import the repo already uses (tooling/release does the same).
import { SOURCE_NAMES } from '../../../repo-hygiene/src/source-names.ts'

const REPO = fileURLToPath(new URL('../../../../', import.meta.url))
const CLI = join(REPO, 'tooling/agent-skills/src/mirror-cli.ts')
const pluginVersion = (
  JSON.parse(readFileSync(join(REPO, 'agents/automata/.claude-plugin/plugin.json'), 'utf8')) as {
    version: string
  }
).version

let out: string
const temps: string[] = []
beforeEach(() => {
  out = mkdtempSync(join(tmpdir(), 'mirror-'))
  temps.push(out)
})
afterEach(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('the mirror tree', () => {
  it('writes a tree Claude Code reads as a marketplace with the automata plugin', () => {
    writeMirror({ repo: REPO, out })
    const pkg = readAgentPackage(out)
    expect(pkg.problems).toEqual([])
    expect(pkg.marketplace?.name).toBe('automata-skills')
    expect(pkg.marketplace?.plugins).toEqual([{ name: 'automata', source: './' }])
    expect(pkg.skills.map((s) => s.name)).toEqual(readAgentPackage(REPO).skills.map((s) => s.name))
    expect(Object.keys(pkg.hooks?.hooks ?? {}).sort()).toEqual(['PostToolUse', 'Stop'])
  })

  it('copies every plugin file byte for byte', () => {
    writeMirror({ repo: REPO, out })
    const differences = diffSkillTrees(join(REPO, 'agents/automata'), out)
    for (const folder of ['skills', 'hooks', 'scripts', '.claude-plugin/plugin.json'])
      expect(differences.filter((d) => d.startsWith(folder))).toEqual([])
  })

  it('adds the README with the three install lines and the version', () => {
    writeMirror({ repo: REPO, out })
    const readme = readFileSync(join(out, 'README.md'), 'utf8')
    for (const line of [
      '/plugin marketplace add mcthaydt/automata-skills',
      '/plugin install automata@automata-skills',
      'npx skills add mcthaydt/automata-skills',
    ])
      expect(readme).toContain(line)
    expect(readme).toContain(pluginVersion)
  })

  it('the README names the editor and says the automatic checks are Claude Code only', () => {
    // The plugin's description names the editor (task 3.4), and only the plugin's hooks run `automata check`:
    // `npx skills add` copies the skills and no hooks, so the README must not promise the checks to other agents.
    writeMirror({ repo: REPO, out })
    const readme = readFileSync(join(out, 'README.md'), 'utf8')
    expect(readme).toContain('level editor')
    expect(readme).toMatch(/In Claude Code, it also runs `automata check`/)
    expect(readme).toContain('only the skills, not the automatic checks')
  })

  it('copies the framework LICENSE byte for byte', () => {
    writeMirror({ repo: REPO, out })
    expect(readFileSync(join(out, 'LICENSE'))).toEqual(readFileSync(join(REPO, 'LICENSE')))
  })

  it('writes nothing else', () => {
    writeMirror({ repo: REPO, out })
    expect(
      diffSkillTrees(join(REPO, 'agents/automata'), out)
        .filter((d) => d.endsWith('only in b'))
        .sort(),
    ).toEqual(['.claude-plugin/marketplace.json: only in b', 'LICENSE: only in b', 'README.md: only in b'])
  })

  it('describes the marketplace in plain words', () => {
    expect(mirrorMarketplace().description).toBe(
      'Skills that teach a coding agent to build games with the Automata Framework.',
    )
  })

  it('the mirror names no source project', () => {
    writeMirror({ repo: REPO, out })
    for (const [path] of listSkillTree(out))
      for (const { pattern } of SOURCE_NAMES)
        expect(pattern.test(readFileSync(join(out, path), 'utf8')), path).toBe(false)
  })
})

describe('the mirror reads like public text', () => {
  // The skills and the API reference are built from doc comments in the packages, so a plan id, an internal record or
  // a package that is not on the registry in a comment lands in a stranger's agent. Nothing else checks the words
  // (`published-only.test.ts` reads `@automata/<name>` only), so this reads the mirror tree itself.
  const INTERNAL_WORDS: readonly (readonly [string, RegExp])[] = [
    ['a plan or decision id', /\b(?:plan )?D-\d+\b/],
    ['an ADR number', /\bADR \d{4}\b/],
    ['an Owner note', /\bOwner, 20\d\d/],
    ['a closed beta', /closed beta/i],
    ['the closed-beta 3D library', /@pixi\/3d/],
  ]

  /** How each private package under `packages/` could be named in prose: its folder, as a path or in code quotes (or
   * bare when it has a hyphen, which no plain word does). Read from the manifests, not typed. */
  function privatePackageForms(): [string, RegExp][] {
    const forms: [string, RegExp][] = []
    for (const folder of readdirSync(join(REPO, 'packages'))) {
      const manifest = JSON.parse(readFileSync(join(REPO, 'packages', folder, 'package.json'), 'utf8')) as {
        private?: boolean
      }
      if (manifest.private !== true) continue
      const bare = folder.includes('-') ? `|(?<![\\w@/.-])${folder}(?![\\w-])` : ''
      forms.push([`the private package ${folder}`, new RegExp(`packages/${folder}\\b|\`${folder}\`${bare}`)])
    }
    return forms
  }

  it('finds the private packages in the workspace (the reader itself works)', () => {
    expect(privatePackageForms().map(([name]) => name)).toEqual(
      expect.arrayContaining(['the private package render-pixi3d', 'the private package editor-3d']),
    )
  })

  it('has no plan id, closed-beta text or private package name', () => {
    writeMirror({ repo: REPO, out })
    const found: string[] = []
    for (const [path] of listSkillTree(out)) {
      const text = readFileSync(join(out, path), 'utf8')
      for (const [what, pattern] of [...INTERNAL_WORDS, ...privatePackageForms()])
        if (pattern.test(text)) found.push(`${path}: ${what}`)
    }
    expect(found).toEqual([])
  })
})

describe('the out folder', () => {
  it('refuses an out folder that holds anything but .git', () => {
    writeFileSync(join(out, 'stale.md'), 'old\n')
    expect(() => writeMirror({ repo: REPO, out })).toThrow(MirrorError)
  })

  it('accepts an out folder holding only .git', () => {
    mkdirSync(join(out, '.git'))
    expect(writeMirror({ repo: REPO, out })).toContain('README.md')
  })

  it('creates the out folder when it does not exist', () => {
    expect(writeMirror({ repo: REPO, out: join(out, 'new/automata-skills') })).toContain('LICENSE')
  })
})

describe('the command line', () => {
  const run = (...args: string[]) => spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8' })

  it('exits 0 and lists what it wrote', () => {
    const result = run('--out', out)
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('README.md')
  })

  it('exits 1 on a non-empty folder', () => {
    writeFileSync(join(out, 'stale.md'), 'old\n')
    expect(run('--out', out).status).toBe(1)
  })

  it('exits 2 without the agent package', () => {
    const empty = mkdtempSync(join(tmpdir(), 'mirror-empty-'))
    temps.push(empty)
    expect(run('--out', out, '--repo', empty).status).toBe(2)
  })
})
