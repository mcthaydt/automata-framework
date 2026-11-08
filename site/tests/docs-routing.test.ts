import { render } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import { getDocSections } from '../src/features/docs/docs-loader'
import { entries, load } from '../src/routes/docs/[slug]/+page'
import SlugPage from '../src/routes/docs/[slug]/+page.svelte'

describe('Docs Canonical Slug Routing', () => {
  it('entries() emits every documentation slug, one per published doc', async () => {
    const slugs = (await entries()) as Array<{ slug: string }>
    expect(slugs.length).toBe(getDocSections().length)
    expect(slugs.length).toBeGreaterThanOrEqual(21)
    const slugNames = slugs.map((s) => s.slug)
    expect(slugNames).toContain('overview')
    expect(slugNames).toContain('quick-start')
    expect(slugNames).toContain('sim-ecs')
    expect(slugNames).toContain('render-pixi')
    expect(slugNames).toContain('effect-runtime')
    expect(slugNames).toContain('security-csp')
    expect(slugNames).toContain('mobile-ui')
    expect(slugNames).toContain('ai-rules')
    expect(slugNames).toContain('capabilities')
    for (const slug of ['service-model', 'saves', 'plus']) expect(slugNames).toContain(slug)
  })

  it('load({ params }) returns the slug for rendering', async () => {
    const result = (await load({ params: { slug: 'sim-ecs' } } as any)) as { slug: string }
    expect(result.slug).toBe('sim-ecs')
  })

  it('renders documentation layout for specific slug', () => {
    const { getAllByText } = render(SlugPage, {
      props: {
        data: { slug: 'sim-ecs' },
      },
    })
    expect(getAllByText(/ECS Simulation & Determinism/i).length).toBeGreaterThan(0)
  })
})
