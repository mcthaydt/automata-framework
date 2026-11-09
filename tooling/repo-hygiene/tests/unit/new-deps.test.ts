import { describe, expect, it } from 'vitest'
import {
  type DependencyReport,
  describeDependencies,
  formatReport,
  type NewDependency,
  newDependencies,
  registryFor,
  scopeRegistries,
} from '#src/new-deps.ts'

// The new-dependency report on pull requests (QB spec §4.1, QB.1): every package a PR adds that main never
// used, with its registry, publisher and weekly downloads, so a reviewer can confirm an agent-added package
// exists and is the intended one. A package missing from its registry fails the report.

const scopes = { '@automata': 'https://npm.pkg.github.com' }

describe('registryFor', () => {
  it('maps a scope from .npmrc, npmjs.org otherwise, and nothing for workspace or file versions', () => {
    expect(registryFor('left-pad', '1.3.0', scopes)).toBe('https://registry.npmjs.org')
    expect(registryFor('@automata/sim', '0.0.2', scopes)).toBe('https://npm.pkg.github.com')
    expect(registryFor('@automata/sim', 'workspace:*', scopes)).toBeUndefined()
    expect(registryFor('@ruken/sdk', 'file:../../vendor/ruken/ruken-sdk-0.0.0.tgz', scopes)).toBeUndefined()
  })
})

describe('scopeRegistries', () => {
  it('reads each `@scope:registry=url` line and drops a trailing slash', () => {
    const npmrc = '@automata:registry=https://npm.pkg.github.com/\n# a comment\nauto-install-peers=true\n'
    expect(scopeRegistries(npmrc)).toEqual({ '@automata': 'https://npm.pkg.github.com' })
  })

  it('has no scopes when the repository has no .npmrc, so every package resolves from npmjs.org', () => {
    expect(scopeRegistries(undefined)).toEqual({})
  })
})

describe('newDependencies', () => {
  const base = {
    'package.json': { devDependencies: { vitest: '5.0.3' } },
    'packages/sim/package.json': { dependencies: { koota: '0.6.6' } },
  }

  it('reports a package that no base manifest uses, with where it was added', () => {
    const head = {
      'package.json': { devDependencies: { vitest: '5.0.3', knip: '6.39.0' } },
      'packages/sim/package.json': { dependencies: { koota: '0.6.6' } },
    }
    expect(newDependencies(base, head, scopes)).toEqual([
      {
        manifest: 'package.json',
        section: 'devDependencies',
        name: 'knip',
        version: '6.39.0',
        registry: 'https://registry.npmjs.org',
      },
    ])
  })

  it('ignores version changes, packages moved between manifests, and workspace or file versions', () => {
    const head = {
      'package.json': { devDependencies: { vitest: '5.0.4' } },
      'packages/sim/package.json': {
        dependencies: { koota: '0.6.6', '@automata/x': 'workspace:*' },
      },
      'packages/new/package.json': { dependencies: { koota: '0.6.6', '@ruken/sdk': 'file:../sdk.tgz' } },
    }
    expect(newDependencies(base, head, scopes)).toEqual([])
  })
})

describe('describeDependencies', () => {
  const knip: NewDependency = {
    manifest: 'package.json',
    section: 'devDependencies',
    name: 'knip',
    version: '6.39.0',
    registry: 'https://registry.npmjs.org',
  }
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

  it('adds the publisher of that version and the weekly downloads from npmjs.org', async () => {
    const urls: string[] = []
    const fetch = async (url: string) => {
      urls.push(url)
      if (url === 'https://registry.npmjs.org/knip') {
        return json({ versions: { '6.39.0': { _npmUser: { name: 'webpro' } } } })
      }
      if (url === 'https://api.npmjs.org/downloads/point/last-week/knip') return json({ downloads: 4321 })
      return json({}, 404)
    }
    expect(await describeDependencies([knip], fetch)).toEqual([
      { ...knip, status: 'found', publisher: 'webpro', weeklyDownloads: 4321 },
    ])
    expect(urls).toHaveLength(2)
  })

  it('marks a package or version missing from npmjs.org', async () => {
    const missing = async () => json({ error: 'Not found' }, 404)
    const [report] = await describeDependencies([{ ...knip, name: 'knip-typo' }], missing)
    expect(report?.status).toBe('missing')
    const noVersion = async (url: string) =>
      url.startsWith('https://registry.npmjs.org/') ? json({ versions: { '1.0.0': {} } }) : json({}, 404)
    const [versionReport] = await describeDependencies([knip], noVersion)
    expect(versionReport?.status).toBe('missing')
  })

  // A peer dependency is a range (`^2.12.4`): the version it names, its lower bound, must be published.
  it("checks a caret or tilde range by the version it names, and marks it missing when that version isn't published", async () => {
    const registry = async (url: string) =>
      url === 'https://registry.npmjs.org/knip'
        ? json({ versions: { '6.39.0': { _npmUser: { name: 'webpro' } } } })
        : json({}, 404)
    const [caret] = await describeDependencies(
      [{ ...knip, section: 'peerDependencies', version: '^6.39.0' }],
      registry,
    )
    expect(caret).toMatchObject({ version: '^6.39.0', status: 'found', publisher: 'webpro' })
    const [tilde] = await describeDependencies([{ ...knip, version: '~6.39.0' }], registry)
    expect(tilde?.status).toBe('found')
    const [absent] = await describeDependencies([{ ...knip, version: '^6.40.0' }], registry)
    expect(absent?.status).toBe('missing')
  })

  it('does not query a registry that needs a token, and says so', async () => {
    const noNetwork = async (): Promise<Response> => {
      throw new Error('fetched')
    }
    const github = { ...knip, name: '@automata/x', registry: 'https://npm.pkg.github.com' }
    expect(await describeDependencies([github], noNetwork)).toEqual([{ ...github, status: 'not checked' }])
  })
})

describe('formatReport', () => {
  it('prints a Markdown table, or one line when nothing is new', () => {
    const row: DependencyReport = {
      manifest: 'package.json',
      section: 'devDependencies',
      name: 'knip',
      version: '6.39.0',
      registry: 'https://registry.npmjs.org',
      status: 'found',
      publisher: 'webpro',
      weeklyDownloads: 4321,
    }
    expect(formatReport([row], 'origin/main')).toBe(
      [
        '### New dependencies versus origin/main',
        '',
        '| Package | Version | Added to | Registry | Publisher | Weekly downloads | Status |',
        '|---|---|---|---|---|---|---|',
        '| `knip` | 6.39.0 | package.json (devDependencies) | https://registry.npmjs.org | webpro | 4321 | found |',
        '',
      ].join('\n'),
    )
    expect(formatReport([], 'origin/main')).toBe('### New dependencies versus origin/main\n\nNone.\n')
  })
})
