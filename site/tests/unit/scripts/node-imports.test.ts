// @vitest-environment node
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// The scripts under site/scripts run with plain `node` (package.json, .github/workflows/site.yml), which does not try
// an extension the way Vite and Vitest do. A relative import without `.ts` or `.js`, anywhere in what a script reaches,
// crashes the script before it checks anything, and the unit tests (which import the functions under Vite) never see it.
const site = process.cwd()
const scripts = readdirSync(join(site, 'scripts'))
  .filter((name) => name.endsWith('.ts') && !name.endsWith('.d.ts'))
  .map((name) => join(site, 'scripts', name))

const SPECIFIER = /(?:\bfrom\s+|\bimport\s*\(?\s*|\bimport\s+)['"]([^'"]+)['"]/g

/** The file a plain-Node import of `specifier` from `from` names, or why it names none. */
function nodeResolve(from: string, specifier: string): { file: string } | { problem: string } | undefined {
  const local = specifier.startsWith('.')
  const alias = specifier.startsWith('#src/')
  if (!local && !alias) return undefined
  const file = local ? resolve(dirname(from), specifier) : join(site, 'src', specifier.slice('#src/'.length))
  if (!/\.(ts|js|json)$/.test(file)) return { problem: `has no .ts or .js extension` }
  if (!existsSync(file)) return { problem: `names a file that does not exist` }
  return { file }
}

function reachable(entry: string): string[] {
  const problems: string[] = []
  const seen = new Set<string>()
  const visit = (file: string) => {
    if (seen.has(file) || !file.endsWith('.ts')) return
    seen.add(file)
    const source = readFileSync(file, 'utf8')
    for (const [, specifier] of source.matchAll(SPECIFIER)) {
      const found = nodeResolve(file, specifier!)
      if (found === undefined) continue
      if ('problem' in found)
        problems.push(`${file.slice(site.length + 1)} imports '${specifier}', which ${found.problem}`)
      else visit(found.file)
    }
  }
  visit(entry)
  return problems
}

describe('the site scripts under plain Node', () => {
  it('imports only files plain Node resolves, in every script and in everything the scripts reach', () => {
    expect(scripts.length).toBeGreaterThan(10)
    expect([...new Set(scripts.flatMap(reachable))]).toEqual([])
  })

  it('check:launch refuses to launch, in its own words, and does not crash on an import', () => {
    const run = spawnSync(process.execPath, ['scripts/check-launch.ts'], { cwd: site, encoding: 'utf8' })
    const output = `${run.stdout}${run.stderr}`
    expect(output).not.toMatch(/ERR_MODULE_NOT_FOUND|Cannot find module/)
    expect(run.status).not.toBe(0)
    expect(output).toContain('The framework’s repository is still private.')
  }, 60_000)
})
