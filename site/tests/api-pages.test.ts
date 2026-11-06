import { render } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import { apiVersions, getApiReference, latestApiVersion } from '../src/lib/api-reference'
import Index from '../src/routes/api/+page.svelte'
import { entries, load } from '../src/routes/api/[version]/[pkg]/+page'
import Package from '../src/routes/api/[version]/[pkg]/+page.svelte'
import type { ApiPackage } from '../src/shared/framework/api.ts'

// M10.4: the complete generated reference, one page per package and version.
describe('/api', () => {
  it('lists every version the site keeps, with its packages linked', () => {
    const view = render(Index)
    const version = latestApiVersion()
    expect(view.getByRole('heading', { level: 2, name: `Version ${version}` })).toBeTruthy()
    const reference = getApiReference(version)!
    for (const pkg of reference.packages)
      expect(view.container.querySelector(`a[href="/api/${version}/${pkg.slug}"]`), pkg.slug).toBeTruthy()
  })

  it('prerenders one page per package of each version', async () => {
    const expected = apiVersions().flatMap((v) =>
      getApiReference(v)!.packages.map((p) => ({ version: v, pkg: p.slug })),
    )
    expect(await entries()).toEqual(expected)
  })

  it('a package page shows every export with its signature, filters by word, and 404s an unknown package', async () => {
    const version = latestApiVersion()
    const data = load({ params: { version, pkg: 'automata-sim' } } as never) as unknown as {
      version: string
      pkg: ApiPackage
    }
    const view = render(Package, { data } as never)
    const total = data.pkg.entryPoints.reduce((n, e) => n + e.entries.length, 0)
    expect(view.container.querySelectorAll('.api-entry')).toHaveLength(total)
    const first = data.pkg.entryPoints[0].entries[0]
    expect(view.container.querySelector(`[id="${first.name}"]`)?.textContent).toContain(
      first.signature.split('\n')[0].slice(0, 20),
    )
    const statusOf = (params: object): number | undefined => {
      try {
        load({ params } as never)
      } catch (thrown) {
        return (thrown as { status: number }).status
      }
    }
    expect(statusOf({ version, pkg: 'nope' })).toBe(404)
    expect(statusOf({ version: '9.9.9', pkg: 'automata-sim' })).toBe(404)
  })
})
