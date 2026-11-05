import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { PLUGIN_ROOT, readAgentPackage } from '#src/layout.ts'

const REPO = resolve(import.meta.dirname, '../../../..')

const temps: string[] = []
afterEach(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true })
})

function writeTree(files: Readonly<Record<string, string>>): string {
  const root = mkdtempSync(join(tmpdir(), 'agent-layout-'))
  temps.push(root)
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), text)
  }
  return root
}

const skill = (name: string, description = `Use ${name}.`) =>
  `---\nname: ${name}\ndescription: ${description}\n---\n\n# ${name}\n`

const HOOKS = {
  hooks: {
    PostToolUse: [
      {
        matcher: 'Edit|Write',
        hooks: [{ type: 'command', command: `node "${PLUGIN_ROOT}/scripts/check.mjs" post-edit` }],
      },
    ],
    Stop: [{ hooks: [{ type: 'command', command: `node "${PLUGIN_ROOT}/scripts/check.mjs" stop` }] }],
  },
}

function goodPackage(): Record<string, string> {
  return {
    '.claude-plugin/marketplace.json': JSON.stringify({
      name: 'automata-framework',
      description: 'Automata',
      owner: { name: 'mcthaydt' },
      plugins: [{ name: 'automata', source: './agents/automata' }],
    }),
    'agents/automata/.claude-plugin/plugin.json': JSON.stringify({
      name: 'automata',
      version: '0.0.2',
      description: 'Automata rules',
      author: { name: 'mcthaydt' },
    }),
    'agents/automata/hooks/hooks.json': JSON.stringify(HOOKS),
    'agents/automata/scripts/check.mjs': '',
    'agents/automata/skills/automata/SKILL.md': skill('automata'),
    'agents/automata/skills/automata-api/SKILL.md': skill('automata-api', '"Has: a colon, quoted."'),
  }
}

describe('readAgentPackage on fixtures', () => {
  it('finds no problem in a good package and lists its skills', () => {
    const result = readAgentPackage(writeTree(goodPackage()))
    expect(result.problems).toEqual([])
    expect(result.skills.map((s) => [s.name, s.description])).toEqual([
      ['automata', 'Use automata.'],
      ['automata-api', 'Has: a colon, quoted.'],
    ])
  })

  const cases: Array<[string, (files: Record<string, string>) => void, RegExp]> = [
    [
      'a skill named unlike its folder',
      (f) => {
        f['agents/automata/skills/automata/SKILL.md'] = skill('other')
      },
      /skills\/automata\/SKILL\.md: name "other" must match its folder "automata"/,
    ],
    [
      'a name that is not lowercase-hyphen',
      (f) => {
        delete f['agents/automata/skills/automata/SKILL.md']
        f['agents/automata/skills/Bad_Name/SKILL.md'] = skill('Bad_Name')
      },
      /Bad_Name\/SKILL\.md: name/,
    ],
    [
      'a missing description',
      (f) => {
        f['agents/automata/skills/automata/SKILL.md'] = '---\nname: automata\n---\n'
      },
      /skills\/automata\/SKILL\.md: description/,
    ],
    [
      'a description over 1,024 characters',
      (f) => {
        f['agents/automata/skills/automata/SKILL.md'] = skill('automata', 'x'.repeat(1025))
      },
      /skills\/automata\/SKILL\.md: description/,
    ],
    [
      'a description YAML would misread (an unquoted ": ")',
      (f) => {
        f['agents/automata/skills/automata/SKILL.md'] = skill('automata', 'Rules: the laws.')
      },
      /skills\/automata\/SKILL\.md: description .*quote/,
    ],
    [
      'a skill folder without SKILL.md',
      (f) => {
        f['agents/automata/skills/empty/notes.md'] = 'x'
      },
      /skills\/empty: no SKILL\.md/,
    ],
    [
      'hooks.json without the top-level hooks key',
      (f) => {
        f['agents/automata/hooks/hooks.json'] = JSON.stringify(HOOKS.hooks)
      },
      /hooks\/hooks\.json/,
    ],
    [
      'a hook command outside the plugin root',
      (f) => {
        f['agents/automata/hooks/hooks.json'] = JSON.stringify({
          hooks: {
            ...HOOKS.hooks,
            Stop: [{ hooks: [{ type: 'command', command: 'node /usr/local/check.mjs' }] }],
          },
        })
      },
      /hooks\/hooks\.json: .*CLAUDE_PLUGIN_ROOT/,
    ],
    [
      'a hook script that does not exist',
      (f) => {
        delete f['agents/automata/scripts/check.mjs']
      },
      /scripts\/check\.mjs does not exist/,
    ],
    [
      'a marketplace source not starting with ./',
      (f) => {
        f['.claude-plugin/marketplace.json'] = JSON.stringify({
          name: 'automata-framework',
          description: 'Automata',
          owner: { name: 'mcthaydt' },
          plugins: [{ name: 'automata', source: 'agents/automata' }],
        })
      },
      /marketplace\.json: .*source/,
    ],
    [
      'a plugin without version, description or author',
      (f) => {
        f['agents/automata/.claude-plugin/plugin.json'] = JSON.stringify({ name: 'automata' })
      },
      /plugin\.json: .*version/,
    ],
  ]

  it.each(cases)('reports %s', (_name, change, expected) => {
    const files = goodPackage()
    change(files)
    const { problems } = readAgentPackage(writeTree(files))
    expect(problems.join('\n')).toMatch(expected)
  })
})

describe("AF's own agent package", () => {
  const result = readAgentPackage(REPO)

  it('has no problems', () => {
    expect(result.problems).toEqual([])
  })

  it('carries the four skills of spec §3.7 and the editor skill (ED3D.14)', () => {
    expect(result.skills.map((s) => s.name)).toEqual([
      'automata',
      'automata-api',
      'automata-editor',
      'automata-feature',
      'automata-verify',
    ])
  })

  it('lists plugin automata from ./agents/automata in marketplace automata-framework', () => {
    expect(result.marketplace).toMatchObject({
      name: 'automata-framework',
      plugins: [{ name: 'automata', source: './agents/automata' }],
    })
    expect(result.plugin?.name).toBe('automata')
  })

  it('runs the check script after sim edits and before the turn ends', () => {
    expect(result.hooks?.hooks.PostToolUse?.[0]?.matcher).toBe('Edit|Write')
    expect(result.hooks?.hooks.PostToolUse?.[0]?.hooks[0]?.command).toContain('check.mjs" post-edit')
    expect(result.hooks?.hooks.Stop?.[0]?.hooks[0]?.command).toContain('check.mjs" stop')
  })
})
