// Which walls of a new sector lie on a neighbour's wall (ED3D.6a step 1, ED3D spec §5.3 flow 2): a wall drawn over the
// same segment as a wall of another sector offers a portal, which `setWallKind` makes on both sides; and what one wall
// can be offered (ED3D.6b step 1). The toy level is a hall (0 to 8 m by 0 to 6 m) and a dock beside it (8 to 14 m), which
// already lead into each other.

import type { AfSector, AfSectorEntry } from '@automata/3d/level'
import { describe, expect, it } from 'vitest'
import { afSectorProfile } from '../profile/af-sector-profile'
import { toyAfSector, toyDock, toyHall } from '../testing/toy-af-sector'
import { portalOffers, wallPortal } from './portal-offers'

const sector = (id: string, corners: AfSectorEntry['corners']): AfSectorEntry => ({
  id,
  floor: 0,
  ceiling: 4,
  light: 1,
  corners,
})

const level = (...more: AfSectorEntry[]): AfSector => toyAfSector({ sectors: [toyHall, toyDock, ...more] })
const offers = (data: AfSector, id: string) => portalOffers(afSectorProfile, data, id)

/** West of the hall, over the hall's west wall (which starts at its corner 3). */
const ANNEX: AfSectorEntry['corners'] = [
  [-6, 0],
  [0, 0],
  [0, 6],
  [-6, 6],
]

describe('portalOffers', () => {
  it('offers a portal for a wall over a neighbour wall, with the corner on each side and the length', () => {
    expect(offers(level(sector('annex', ANNEX)), 'annex')).toEqual([
      { sector: 'annex', corner: 1, to: 'hall', toCorner: 3, length: 6 },
    ])
  })

  it('offers one for each such wall, in the order of the sector corners', () => {
    // South of both rooms, with a corner at x = 8, so that one wall lies over each south wall.
    const south = sector('south', [
      [0, 6],
      [8, 6],
      [14, 6],
      [14, 10],
      [0, 10],
    ])
    expect(offers(level(south), 'south')).toEqual([
      { sector: 'south', corner: 0, to: 'hall', toCorner: 2, length: 8 },
      { sector: 'south', corner: 1, to: 'dock', toCorner: 2, length: 6 },
    ])
  })

  it('offers none for a wall that only touches a neighbour, or lies on part of its wall', () => {
    const touching = sector('touching', [
      [-4, 6],
      [0, 6],
      [0, 9],
      [-4, 9],
    ])
    const partial = sector('partial', [
      [2, 6],
      [6, 6],
      [6, 9],
      [2, 9],
    ])
    expect(offers(level(touching), 'touching')).toEqual([])
    expect(offers(level(partial), 'partial')).toEqual([])
  })

  it('offers none for a sector with no neighbour, or one that is not there', () => {
    const far = sector('far', [
      [30, 30],
      [34, 30],
      [34, 34],
      [30, 34],
    ])
    expect(offers(level(far), 'far')).toEqual([])
    expect(offers(level(far), 'nowhere')).toEqual([])
  })

  it('gives the same offers for an outline written the other way round', () => {
    const turned = sector('annex', [...ANNEX].reverse())
    // Reversed, the wall over the hall's west wall starts at the corner that was the third: (0, 6) to (0, 0).
    expect(offers(level(turned), 'annex')).toEqual([
      { sector: 'annex', corner: 1, to: 'hall', toCorner: 3, length: 6 },
    ])
  })

  it('leaves out a neighbour wall that already leads into another sector, and keeps one that leads into this one', () => {
    const westOf = (next: string): AfSector =>
      toyAfSector({
        sectors: [
          {
            ...toyHall,
            corners: toyHall.corners.map((corner, i) => (i === 3 ? ([0, 6, { next }] as const) : corner)),
          },
          toyDock,
          sector('annex', ANNEX),
        ],
      })
    expect(offers(westOf('elsewhere'), 'annex')).toEqual([])
    expect(offers(westOf('annex'), 'annex')).toEqual([
      { sector: 'annex', corner: 1, to: 'hall', toCorner: 3, length: 6 },
    ])
  })

  it('offers the wall whose own side already leads there, which completes the pair', () => {
    const half: AfSectorEntry['corners'] = ANNEX.map((corner, i) =>
      i === 1 ? ([0, 0, { next: 'hall' }] as const) : corner,
    )
    expect(offers(level(sector('annex', half)), 'annex')).toEqual([
      { sector: 'annex', corner: 1, to: 'hall', toCorner: 3, length: 6 },
    ])
  })

  it('offers a wall one portal when two neighbours lie on it, into the first in the level', () => {
    const twin = sector('twin', [
      [-3, 0],
      [0, 0],
      [0, 6],
      [-3, 6],
    ])
    expect(offers(level(sector('annex', ANNEX), twin), 'annex')).toEqual([
      { sector: 'annex', corner: 1, to: 'hall', toCorner: 3, length: 6 },
    ])
  })

  it('leaves out a wall that already is the portal pair, and the hall and dock that are one', () => {
    // The hall and the dock lead into each other already: nothing to offer for either.
    expect(offers(level(), 'hall')).toEqual([])
    expect(offers(level(), 'dock')).toEqual([])
  })
})

describe('wallPortal', () => {
  const portal = (data: AfSector, id: string, corner: number) => wallPortal(afSectorProfile, data, id, corner)

  /** The hall with its west wall (corner 3) leading into `next`. */
  const hallLeadingWest = (next: string): AfSectorEntry => ({
    ...toyHall,
    corners: toyHall.corners.map((corner, i) => (i === 3 ? ([0, 6, { next }] as const) : corner)),
  })

  it('gives the offer of a wall over a neighbour wall, the one portalOffers gives for it', () => {
    const data = level(sector('annex', ANNEX))
    expect(portal(data, 'annex', 1)).toEqual({
      kind: 'offer',
      offer: { sector: 'annex', corner: 1, to: 'hall', toCorner: 3, length: 6 },
    })
    expect(offers(data, 'annex')).toEqual([(portal(data, 'annex', 1) as { offer: unknown }).offer])
  })

  it('says done for a wall whose two sides already lead into each other, from either side', () => {
    expect(portal(level(), 'hall', 1)).toEqual({ kind: 'done', to: 'dock' })
    expect(portal(level(), 'dock', 3)).toEqual({ kind: 'done', to: 'hall' })
  })

  it('says taken, with where it leads, for a wall over one that leads into a third sector', () => {
    const data = toyAfSector({ sectors: [hallLeadingWest('elsewhere'), toyDock, sector('annex', ANNEX)] })
    expect(portal(data, 'annex', 1)).toEqual({ kind: 'taken', to: 'elsewhere' })
  })

  it('says none for a wall with nothing over it, a corner that is not there and a sector that is not', () => {
    const data = level(sector('annex', ANNEX))
    expect(portal(data, 'annex', 0)).toEqual({ kind: 'none' })
    expect(portal(data, 'annex', 9)).toEqual({ kind: 'none' })
    expect(portal(data, 'annex', -1)).toEqual({ kind: 'none' })
    expect(portal(data, 'nowhere', 0)).toEqual({ kind: 'none' })
  })

  it('offers the first neighbour that can take the portal, past one that is done or taken', () => {
    const twin = sector('twin', [
      [-3, 0],
      [0, 0],
      [0, 6],
      [-3, 6],
    ])
    const data = toyAfSector({
      sectors: [hallLeadingWest('elsewhere'), toyDock, sector('annex', ANNEX), twin],
    })
    expect(portal(data, 'annex', 1)).toEqual({
      kind: 'offer',
      offer: { sector: 'annex', corner: 1, to: 'twin', toCorner: 1, length: 6 },
    })
  })

  it('gives the reason of the first neighbour over the wall when none of them can take it', () => {
    const twinEast = (next: string): AfSectorEntry => ({
      ...sector('twin', [
        [-3, 0],
        [0, 0],
        [0, 6],
        [-3, 6],
      ]),
      corners: [
        [-3, 0],
        [0, 0, { next }],
        [0, 6],
        [-3, 6],
      ],
    })
    const bothTaken = toyAfSector({
      sectors: [hallLeadingWest('elsewhere'), toyDock, sector('annex', ANNEX), twinEast('somewhere')],
    })
    expect(portal(bothTaken, 'annex', 1)).toEqual({ kind: 'taken', to: 'elsewhere' })
    // The annex's wall leads into the twin already and the twin's leads back (done), after the hall's that is taken.
    const annexToTwin: AfSectorEntry['corners'] = ANNEX.map((corner, i) =>
      i === 1 ? ([0, 0, { next: 'twin' }] as const) : corner,
    )
    const takenThenDone = toyAfSector({
      sectors: [hallLeadingWest('elsewhere'), toyDock, sector('annex', annexToTwin), twinEast('annex')],
    })
    expect(portal(takenThenDone, 'annex', 1)).toEqual({ kind: 'taken', to: 'elsewhere' })
  })

  it('offers a wall whose own side already leads there, which completes the pair', () => {
    const half: AfSectorEntry['corners'] = ANNEX.map((corner, i) =>
      i === 1 ? ([0, 0, { next: 'hall' }] as const) : corner,
    )
    expect(portal(level(sector('annex', half)), 'annex', 1)).toEqual({
      kind: 'offer',
      offer: { sector: 'annex', corner: 1, to: 'hall', toCorner: 3, length: 6 },
    })
  })
})
