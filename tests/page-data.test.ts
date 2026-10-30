import { render } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
vi.mock('$app/environment', () => ({ browser: true }))
import { load as loadHome } from '../src/routes/+page'
import { load as loadExamples } from '../src/routes/examples/+page'
import { getExampleProject, type ProjectSource } from '../src/data/projects'
import Home from '../src/routes/+page.svelte'
import ExamplesPage from '../src/routes/examples/+page.svelte'

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

  it('gives the gallery the project of the demo it selects', async () => {
    const data = await loadExamples({ url: new URL('https://example.test/examples?demo=bodies-2d') } as any)
    expect(data.demo).toBe('bodies-2d')
    expect(data.project).toBe(getExampleProject('bodies-2d'))
  })

  it('gives the gallery the project of the fallback demo when the slug is unknown', async () => {
    const data = await loadExamples({ url: new URL('https://example.test/examples?demo=missing') } as any)
    expect(data.demo).toBe('bodies-2d')
    expect(data.project).toBe(getExampleProject('bodies-2d'))
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

  it('in the gallery', () => {
    const view = render(ExamplesPage, { props: { data: { demo: 'base-2d', project } } })
    expect(view.getByRole('button', { name: 'Open games/sample/main.ts' })).toBeTruthy()
  })
})
