import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { checkApiReference } from '#src/api-reference.ts'
import { runAgentSkills } from '#src/cli.ts'

const GENERATED = 'tooling/api-index/dist/api.md'
const COMMITTED = 'agents/automata/skills/automata-api/reference/api.md'
const PLUGIN = 'agents/automata/.claude-plugin/plugin.json'

const temps: string[] = []
afterEach(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true })
})

const api = (version: string, body = 'x') => `# Automata API reference, version ${version}\n\n${body}\n`

function repo(files: Readonly<Record<string, string>>): string {
  const root = mkdtempSync(join(tmpdir(), 'api-ref-'))
  temps.push(root)
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), text)
  }
  return root
}

const plugin = (version: string) =>
  JSON.stringify({ name: 'automata', version, description: 'd', author: { name: 'mcthaydt' } }, null, 2)

describe('checkApiReference', () => {
  it('is in sync when the committed copy equals the generated file and the versions agree', () => {
    const root = repo({ [GENERATED]: api('0.0.2'), [COMMITTED]: api('0.0.2'), [PLUGIN]: plugin('0.0.2') })
    expect(checkApiReference(root, { write: false }).status).toBe('in-sync')
  })

  it('reports a differing copy, and --write copies the generated file', () => {
    const root = repo({
      [GENERATED]: api('0.0.2', 'new'),
      [COMMITTED]: api('0.0.2', 'old'),
      [PLUGIN]: plugin('0.0.2'),
    })
    expect(checkApiReference(root, { write: false }).status).toBe('differs')
    expect(checkApiReference(root, { write: true }).status).toBe('written')
    expect(readFileSync(join(root, COMMITTED), 'utf8')).toBe(api('0.0.2', 'new'))
    expect(checkApiReference(root, { write: false }).status).toBe('in-sync')
  })

  it('reports a missing copy as differing', () => {
    const root = repo({ [GENERATED]: api('0.0.2'), [PLUGIN]: plugin('0.0.2') })
    expect(checkApiReference(root, { write: false }).status).toBe('differs')
  })

  it('reports a plugin version unlike the API version, and --write sets it', () => {
    const root = repo({ [GENERATED]: api('0.0.3'), [COMMITTED]: api('0.0.3'), [PLUGIN]: plugin('0.0.2') })
    const check = checkApiReference(root, { write: false })
    expect(check.status).toBe('version-mismatch')
    expect(check.message).toContain('0.0.2')
    expect(check.message).toContain('0.0.3')
    expect(checkApiReference(root, { write: true }).status).toBe('written')
    expect(JSON.parse(readFileSync(join(root, PLUGIN), 'utf8')).version).toBe('0.0.3')
  })

  it('needs a build', () => {
    const root = repo({ [COMMITTED]: api('0.0.2'), [PLUGIN]: plugin('0.0.2') })
    const check = checkApiReference(root, { write: false })
    expect(check.status).toBe('missing-build')
    expect(check.message).toContain('pnpm build && pnpm api-index')
  })
})

describe('runAgentSkills (the CLI body)', () => {
  const quiet = { stdout: () => {}, stderr: () => {} }
  // The rest of a valid agent package, so only the API reference decides the exit code.
  const layout = {
    '.claude-plugin/marketplace.json': JSON.stringify({
      name: 'automata-framework',
      description: 'd',
      owner: { name: 'mcthaydt' },
      plugins: [{ name: 'automata', source: './agents/automata' }],
    }),
    'agents/automata/hooks/hooks.json': JSON.stringify({ hooks: {} }),
    'agents/automata/skills/automata/SKILL.md': '---\nname: automata\ndescription: d\n---\n',
    'agents/automata/skills/automata-api/SKILL.md': '---\nname: automata-api\ndescription: d\n---\n',
  }

  it('exits 0 in sync, 1 when the copy differs, 2 without a build', () => {
    const synced = repo({
      ...layout,
      [GENERATED]: api('0.0.2'),
      [COMMITTED]: api('0.0.2'),
      [PLUGIN]: plugin('0.0.2'),
    })
    const stale = repo({
      ...layout,
      [GENERATED]: api('0.0.2', 'a'),
      [COMMITTED]: api('0.0.2', 'b'),
      [PLUGIN]: plugin('0.0.2'),
    })
    const unbuilt = repo({ ...layout, [COMMITTED]: api('0.0.2'), [PLUGIN]: plugin('0.0.2') })
    expect(runAgentSkills(['--root', synced], quiet)).toBe(0)
    expect(runAgentSkills(['--root', stale], quiet)).toBe(1)
    expect(runAgentSkills(['--root', unbuilt], quiet)).toBe(2)
  })

  it("exits 1 on a layout problem in the repo's agent package", () => {
    const root = repo({ [GENERATED]: api('0.0.2'), [COMMITTED]: api('0.0.2'), [PLUGIN]: plugin('0.0.2') })
    const errors: string[] = []
    expect(runAgentSkills(['--root', root], { stdout: () => {}, stderr: (m) => errors.push(m) })).toBe(1)
    expect(errors.join('')).toContain('marketplace.json: missing')
  })
})
