import { render } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import DocsPage from '#src/features/docs/DocsPage.svelte'
import { getDocBySlug, getDocs } from '#src/features/docs/docs-loader'
import { entries, load } from '#src/routes/docs/[slug]/+page'

// The docs are the framework's guides and nothing else: the site keeps no copy of its own.
describe('the docs', () => {
  const docs = getDocs()

  it('are the guides, How it works first', () => {
    expect(docs.map((doc) => doc.slug)).toEqual([
      'how-it-works',
      'editor',
      'extensions',
      'publish-to-web',
      'publish-to-itch',
      'publish-to-desktop',
      'publish-to-ruken',
    ])
  })

  it('say nothing the framework no longer is', () => {
    for (const doc of docs) {
      expect(doc.content, doc.slug).not.toMatch(/Effect Runtime|Effect service|Context\.Tag|TestClock/)
      expect(doc.content, doc.slug).not.toMatch(/desktop[^.]*\bplanned\b|\bplanned\b[^.]*desktop/i)
    }
  })

  it('prerender one page per guide, and 404 any other', async () => {
    expect(await entries()).toEqual(docs.map((doc) => ({ slug: doc.slug })))
    expect(await load({ params: { slug: 'editor' } } as never)).toEqual({ slug: 'editor' })
    await expect(async () => load({ params: { slug: 'sim-ecs' } } as never)).rejects.toMatchObject({
      status: 404,
    })
  })

  it('send every old docs address to a page that exists', () => {
    const pages = new Set([
      '/',
      '/start',
      '/editor',
      '/api',
      '/terms',
      ...docs.map((doc) => '/docs/' + doc.slug),
    ])
    for (const slug of [
      'overview',
      'quick-start',
      'sim-ecs',
      'render-pixi',
      'effect-runtime',
      'security-csp',
      'mobile-ui',
      'ai-rules',
      'agent-setup',
      'capabilities',
      'audience',
      'faq',
      'service-model',
      'saves',
      'plus',
      'from-unity',
      'from-godot',
      'from-unreal',
      'from-gamemaker',
      'from-web',
    ]) {
      expect(getDocBySlug(slug), slug).toBeUndefined()
    }
  })

  it('list every guide in one nav, the open one marked, with next and previous', () => {
    const view = render(DocsPage, { slug: 'editor' })
    // The list is drawn twice (beside the guide, and folded above it on a phone); CSS shows one.
    const nav = view.getAllByRole('navigation', { name: 'Guides' })[0] as HTMLElement
    const links = [...nav.querySelectorAll('a')]
    expect(links.map((link) => link.getAttribute('href'))).toEqual(docs.map((doc) => '/docs/' + doc.slug))
    expect(nav.querySelector('[aria-current="page"]')?.textContent).toBe('Draw levels in the editor')
    expect(view.getByRole('link', { name: 'Previous: How it works' })).toBeTruthy()
    expect(view.getByRole('link', { name: 'Next: Extensions: add what your game needs' })).toBeTruthy()
  })
})
