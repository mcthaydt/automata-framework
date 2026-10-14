import { render } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import { entries, load } from '../src/routes/docs/[slug]/+page'
import SlugPage from '../src/routes/docs/[slug]/+page.svelte'

describe('Docs Canonical Slug Routing', () => {
  it('entries() emits all 8 canonical documentation slugs', () => {
    const slugs = entries()
    expect(slugs.length).toBe(8)
    const slugNames = slugs.map((s) => s.slug)
    expect(slugNames).toContain('overview')
    expect(slugNames).toContain('quick-start')
    expect(slugNames).toContain('sim-ecs')
    expect(slugNames).toContain('render-pixi')
    expect(slugNames).toContain('effect-runtime')
    expect(slugNames).toContain('security-csp')
    expect(slugNames).toContain('mobile-ui')
    expect(slugNames).toContain('ai-rules')
  })

  it('load({ params }) returns the slug for rendering', () => {
    const result = load({ params: { slug: 'sim-ecs' } } as any)
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
