// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import NewSectorCard from '#src/features/levels-3d/plan/NewSectorCard.svelte'
import type { DrawEdge } from '#src/features/levels-3d/plan/sector-tool-controller.ts'

// The New sector card (plan ED3D.6g-b step 6; ED3D spec §9 `Draw a sector`): each placed point with its coordinates and
// the length of the edge that reaches it, then what the next tap does.

const first = { x: -4.875, z: -3.8 }
const second = { x: -4.875, z: -6.8 }
const third = { x: -1.9, z: -6.8 }
const corners = [first, second, third]
const edges: DrawEdge[] = [
  { a: first, b: second, length: 3, pending: false },
  { a: second, b: third, length: 2.975, pending: false },
  { a: third, b: { x: -1.9, z: -3.8 }, length: 3, pending: true },
]

describe('NewSectorCard', () => {
  it('lists the points with their edge lengths', () => {
    render(NewSectorCard, { corners, edges, closing: false })
    expect(screen.getByRole('heading', { name: 'New sector' })).toBeInTheDocument()
    const rows = within(screen.getByRole('list', { name: 'Points' })).getAllByRole('listitem')
    expect(rows.map((row) => row.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
      '1 -4.875, -3.800',
      '2 -4.875, -6.800 3.00 m',
      '3 -1.900, -6.800 2.98 m',
    ])
    expect(screen.getByText('Tap to place point 4')).toBeInTheDocument()
  })

  it('says a tap closes the sector when it would', () => {
    render(NewSectorCard, { corners, edges, closing: true })
    expect(screen.getByText('A tap on point 1 closes the sector')).toBeInTheDocument()
  })

  it('says a rectangle closes on its second point', () => {
    render(NewSectorCard, {
      corners: [first, second],
      edges: edges.slice(0, 1),
      closing: true,
      shape: 'rectangle',
    })
    expect(screen.getByText('A tap on point 2 closes the sector')).toBeInTheDocument()
  })
})
