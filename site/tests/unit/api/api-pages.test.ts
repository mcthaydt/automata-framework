import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fireEvent, render } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import Index from '../../../src/features/api/ApiIndex.svelte'
import Package from '../../../src/features/api/ApiPackage.svelte'
import { entries, load } from '../../../src/routes/api/[version]/[pkg]/+page'
import type { ApiPackage } from '../../../src/shared/framework/api.ts'
import { apiVersions, getApiReference, latestApiVersion } from '../../../src/shared/framework/api-reference'

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

  it('groups the packages under Core and Extensions, every extensions/* package under Extensions', () => {
    const view = render(Index)
    const listed = (heading: string): string[] => {
      const list = view.getByRole('heading', { level: 3, name: heading }).nextElementSibling
      return [...(list?.querySelectorAll('a') ?? [])].map((link) => link.textContent ?? '')
    }
    const core = listed('Core')
    const extensions = listed('Extensions')
    expect(core).toEqual(['@automata/content', '@automata/framework', '@automata/sim', '@automata/tools'])
    const published = readdirSync(resolve('../extensions'), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => JSON.parse(readFileSync(resolve('../extensions', entry.name, 'package.json'), 'utf8')))
      .filter((manifest) => manifest.private !== true)
      .map((manifest) => manifest.name as string)
    expect(published.length).toBeGreaterThan(0)
    for (const name of published) expect(extensions, name).toContain(name)
    expect(extensions.filter((name) => core.includes(name))).toEqual([])
  })

  it('has one page for each published package, under its current name', () => {
    const names = getApiReference(latestApiVersion())!.packages.map((pkg) => pkg.name)
    // The four core packages and the nine free extensions, which are published too.
    expect(names).toEqual([
      '@automata/audio-synth',
      '@automata/content',
      '@automata/debug',
      '@automata/feel',
      '@automata/framework',
      '@automata/net',
      '@automata/net-server',
      '@automata/net-ui',
      '@automata/physics',
      '@automata/puzzle',
      '@automata/sim',
      '@automata/tools',
      '@automata/ui-screens',
    ])
  })

  it('prerenders one page per package of each version', async () => {
    const expected = apiVersions().flatMap((v) =>
      getApiReference(v)!.packages.map((p) => ({ version: v, pkg: p.slug })),
    )
    expect(await entries()).toEqual(expected)
  })

  it('a package page shows every export with its signature, filters by word, and 404s an unknown package', async () => {
    const version = latestApiVersion()
    const data = load({ params: { version, pkg: 'sim' } } as never) as unknown as {
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
    expect(statusOf({ version: '9.9.9', pkg: 'sim' })).toBe(404)
  })

  it('a package page is short: its groups folded into a list of rows, and a filter opens what matches', async () => {
    const version = latestApiVersion()
    const data = load({ params: { version, pkg: 'framework' } } as never) as unknown as {
      version: string
      pkg: ApiPackage
    }
    const view = render(Package, { data } as never)
    const groups = [...view.container.querySelectorAll<HTMLDetailsElement>('details.api-group')]
    expect(groups).toHaveLength(data.pkg.entryPoints.length)
    expect(groups.every((group) => !group.open)).toBe(true)
    // Every export is a fold too: the row shows its name, the signature waits inside.
    expect(
      [...view.container.querySelectorAll<HTMLDetailsElement>('details.api-entry')].some((e) => e.open),
    ).toBe(false)
    await fireEvent.input(view.getByLabelText('Filter this package'), { target: { value: 'startGame' } })
    const open = [...view.container.querySelectorAll<HTMLDetailsElement>('details.api-group')]
    expect(open.length).toBeGreaterThan(0)
    expect(open.every((group) => group.open)).toBe(true)
    expect(view.container.querySelector('[id="startGame"]')).toBeTruthy()
  })

  it('shows a doc comment’s backticks as code, not as raw marks', () => {
    const version = latestApiVersion()
    const pkg = getApiReference(version)!.packages.find((candidate) =>
      candidate.entryPoints.some((point) => point.entries.some((entry) => entry.doc.includes('`'))),
    )!
    const view = render(Package, { data: { version, pkg } } as never)
    const withCode = [...view.container.querySelectorAll('details.api-entry > p')].filter((p) =>
      p.querySelector('code'),
    )
    expect(withCode.length).toBeGreaterThan(0)
    for (const p of withCode) expect(p.textContent).not.toContain('`')
  })
})
