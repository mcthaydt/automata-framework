// @vitest-environment jsdom
import { render, screen } from '@testing-library/svelte'
import { createRawSnippet } from 'svelte'
import { describe, expect, it } from 'vitest'
import Pill from '#src/shared/kit/widgets/Pill.svelte'

const text = (label: string) => createRawSnippet(() => ({ render: () => `<span>${label}</span>` }))

describe('Pill', () => {
  it('shows its words', () => {
    render(Pill, { children: text('Valid') })
    expect(screen.getByText('Valid')).toBeInTheDocument()
  })

  it('carries a state tone, neutral unless told', () => {
    const { unmount } = render(Pill, { children: text('Valid') })
    expect(screen.getByText('Valid').closest('[data-pill]')).toHaveAttribute('data-tone', 'neutral')
    unmount()
    render(Pill, { tone: 'warn', children: text('1 warning') })
    expect(screen.getByText('1 warning').closest('[data-pill]')).toHaveAttribute('data-tone', 'warn')
  })

  it('takes its colour from an accent variable when given one', () => {
    render(Pill, { accent: '--color-layer-sky', children: text('Platformer') })
    const pill = screen.getByText('Platformer').closest<HTMLElement>('[data-pill]')
    expect(pill?.style.getPropertyValue('--pill-color')).toBe('var(--color-layer-sky)')
    expect(pill).not.toHaveAttribute('data-tone')
  })
})
