import { render, screen } from '@testing-library/svelte'
import { flushSync } from 'svelte'
import { describe, expect, it } from 'vitest'
import { stubGeometry } from '../../testing/kit/stub-geometry.svelte.ts'
import ShellProbe from '../../testing/level-2d/ShellProbe.svelte'

// The Svelte toolchain of this package: a component of ours mounts the kit's shell in jsdom, with the kit's geometry
// stand-in, the jest-dom matchers and Svelte's runes all working. Real screens are tested beside their components.

describe('the Svelte toolchain', () => {
  it('mounts a component of this package around the kit shell, and follows the geometry', () => {
    const geometry = stubGeometry(1194, 834)
    render(ShellProbe, { geometry })
    const shell = document.querySelector('[data-editor-shell]')
    expect(shell).toHaveAttribute('data-mode', 'wide')
    expect(screen.getByRole('heading', { name: 'Probe' })).toBeInTheDocument()
    geometry.resize(834, 1194)
    flushSync()
    expect(shell).toHaveAttribute('data-mode', 'medium')
  })
})
