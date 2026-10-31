import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import NudgePad from './NudgePad.svelte'

// The nudge pad (plan ED3D.6g-b step 6; ED3D spec §5.3 flow 2, §9): four arrows move the last corner one grid step on
// the plan (up is north, towards smaller z), and the middle closes the sector.

describe('NudgePad', () => {
  it('nudges the last corner one step each way and closes from the middle', async () => {
    const onnudge = vi.fn()
    const onclose = vi.fn()
    render(NudgePad, { x: 10, y: 20, onnudge, onclose })
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

  it('sits where it is placed', () => {
    render(NudgePad, { x: 10, y: 20, onnudge: vi.fn(), onclose: vi.fn() })
    const pad = screen.getByRole('group', { name: 'Nudge the last corner' })
    expect(pad.style.left).toBe('10px')
    expect(pad.style.top).toBe('20px')
  })
})
