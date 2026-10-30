import { render } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
vi.mock('$app/environment', () => ({ browser: true }))
import { load as loadHome } from '../src/routes/+page'
import { load as loadExample } from '../src/routes/examples/[id]/+page'
import { type ProjectSource } from '../src/data/projects'
import Home from '../src/routes/+page.svelte'

// QB.3h. The example sources are 372 KB (every example project, shared files once) and the home page and the gallery
// showed one project each, yet both imported the whole module, so the browser modulepreloaded a 380 KB chunk in the first
// second, ahead of the images and styles the first paint waits for. The pages now get their project from their load
// function, which imports the module on demand. tests/site-checks.test.ts holds the gate on the built pages.
describe('the project a page shows comes from its load function', () => {
  it('gives the home page the starter project', async () => {
    const data = await loadHome()
    expect(data.starterProject.slug).toBe('base-2d')
    expect(data.starterProject.files.map(file => file.path)).toContain('games/emberwick/src/content/room.ts')
  })

  // WEB.PLAY.5: the catalog's sources (examples.json) follow the same rule. An example page's data carries its own
  // example and the source-free index, never the other sources.
  it('gives an example page its own example and no other source', async () => {
    const data = (await loadExample({ params: { id: 'shapes-rects' } } as any)) as { example: { id: string; source: string }; index: unknown }
    expect(data.example.id).toBe('shapes-rects')
    expect(JSON.stringify(data.index)).not.toContain("from '@mcthaydt/automata'")
  })
})

describe('the pages show the project in their data', () => {
  const project: ProjectSource = {
    slug: 'base-2d',
    root: 'games/sample',
    name: 'Sample',
    command: 'pnpm sample dev',
    files: [{ path: 'games/sample/main.ts', language: 'ts', content: 'export const sample = 1\n' }],
  }

  it('on the home page', () => {
    const view = render(Home, { props: { data: { starterProject: project } } })
    expect(view.getByRole('button', { name: 'Open games/sample/main.ts' })).toBeTruthy()
  })
})
