// @vitest-environment jsdom
import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import NudgePad from '#src/features/levels-3d/plan/NudgePad.svelte'

// The nudge pad (plan ED3D.6g-b step 6; ED3D spec §5.3 flow 2, §9): four arrows move the last corner one grid step on
// the plan (up is north, towards smaller z), and the middle closes the sector.

describe('NudgePad', () => {
  it('nudges the last corner one step each way and closes from the middle', async () => {
    const onnudge = vi.fn()
    const onclose = vi.fn()
    render(NudgePad, { side: 'right', onnudge, onclose })
    for (const name of ['Nudge up', 'Nudge right', 'Nudge down', 'Nudge left'])
      await userEvent.click(screen.getByRole('button', { name }))
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onnudge.mock.calls).toEqual([
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ])
    expect(onclose).toHaveBeenCalledOnce()
  })

  it('sits in the corner it is given', () => {
    render(NudgePad, { side: 'left', onnudge: vi.fn(), onclose: vi.fn() })
    expect(screen.getByRole('group', { name: 'Nudge the last corner' })).toHaveAttribute('data-side', 'left')
  })
})
