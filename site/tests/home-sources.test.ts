import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fireEvent, render, waitFor } from '@testing-library/svelte'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { STARTER_FILE } from '../src/data/home-sources'
import { getExampleProject, type ProjectSource } from '../src/data/projects'
import SourceExplorer from '../src/lib/components/SourceExplorer.svelte'
import { load as loadHome } from '../src/routes/+page.server'
import { entries, GET } from '../src/routes/sources/[slug].json/+server'

// The home page's Lighthouse blocking time sat near its 200 ms budget on the Mac: its load ran again in the browser at
// hydration and imported the 260 KB example-sources chunk to show the starter (196 KB of it). Now the server load sends the
// file list and the one file shown first; the explorer fetches the project's prerendered sources the first time another
// file is chosen.

const root = resolve(import.meta.dirname, '..')
const emberwick = getExampleProject('emberwick')!

describe('the home page’s starter project', () => {
  it('lists every file, carries only the first file’s content, and marks the rest deferred', async () => {
    const { starterProject } = (await loadHome()) as { starterProject: ProjectSource }
    expect(starterProject.files.map((file) => file.path)).toEqual(emberwick.files.map((file) => file.path))
    for (const file of starterProject.files) {
      const full = emberwick.files.find((other) => other.path === file.path)!
      if (file.path === STARTER_FILE) expect(file).toEqual(full)
      else if (full.content === undefined) expect(file).toEqual(full)
      else expect(file).toEqual({ path: full.path, language: full.language, deferred: true })
    }
    expect(JSON.stringify(starterProject).length).toBeLessThan(20_000)
  })

  it('is loaded on the server only, so no browser module on the page imports the example sources', () => {
    expect(existsSync(resolve(root, 'src/routes/+page.ts'))).toBe(false)
    for (const file of ['src/routes/+page.svelte', 'src/lib/components/SourceExplorer.svelte'])
      expect(readFileSync(resolve(root, file), 'utf8')).not.toMatch(/import (?!type)[^\n]*data\/projects'/)
  })
})

describe('/sources/<slug>.json', () => {
  it('is prerendered for every project and holds each file as published', async () => {
    expect(entries()).toContainEqual({ slug: 'emberwick' })
    const response = await GET({ params: { slug: 'emberwick' } } as never)
    expect(await response.json()).toEqual(emberwick.files)
  })
})

describe('the explorer with deferred files', () => {
  afterEach(() => vi.unstubAllGlobals())
  const deferred: ProjectSource = {
    slug: 'base-2d',
    root: 'games/sample',
    name: 'Sample',
    command: 'pnpm sample dev',
    files: [
      { path: 'games/sample/main.ts', language: 'typescript', content: 'export const first = 1\n' },
      { path: 'games/sample/other.ts', language: 'typescript', deferred: true },
      { path: 'games/sample/more.ts', language: 'typescript', deferred: true },
    ],
  }
  const full = [
    { path: 'games/sample/main.ts', language: 'typescript', content: 'export const first = 1\n' },
    { path: 'games/sample/other.ts', language: 'typescript', content: 'export const other = 2\n' },
    { path: 'games/sample/more.ts', language: 'typescript', content: 'export const more = 3\n' },
  ]

  it('fetches the project’s sources once, the first time a deferred file is chosen', async () => {
    const fetchSources = vi.fn(async () => new Response(JSON.stringify(full)))
    vi.stubGlobal('fetch', fetchSources)
    const view = render(SourceExplorer, { props: { project: deferred, initialFile: 'games/sample/main.ts' } })
    expect(view.getByRole('region', { name: 'games/sample/main.ts' }).textContent).toContain('first = 1')
    expect(fetchSources).not.toHaveBeenCalled()
    await fireEvent.click(view.getByRole('button', { name: 'Open games/sample/other.ts' }))
    await waitFor(() =>
      expect(view.getByRole('region', { name: 'games/sample/other.ts' }).textContent).toContain('other = 2'),
    )
    await fireEvent.click(view.getByRole('button', { name: 'Open games/sample/more.ts' }))
    await waitFor(() =>
      expect(view.getByRole('region', { name: 'games/sample/more.ts' }).textContent).toContain('more = 3'),
    )
    expect(fetchSources).toHaveBeenCalledTimes(1)
    expect(fetchSources).toHaveBeenCalledWith('/sources/base-2d.json')
  })

  it('says the file could not be loaded, with its GitHub link, when the fetch fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 500 })),
    )
    const view = render(SourceExplorer, { props: { project: deferred, initialFile: 'games/sample/main.ts' } })
    await fireEvent.click(view.getByRole('button', { name: 'Open games/sample/other.ts' }))
    await waitFor(() => expect(view.getByText(/could not be loaded/)).toBeTruthy())
    expect(view.getByRole('link', { name: 'View file on GitHub' }).getAttribute('href')).toContain(
      'games/sample/other.ts',
    )
  })
})
