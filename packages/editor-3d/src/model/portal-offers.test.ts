// Which walls of a new sector lie on a neighbour's wall (ED3D.6a step 1, ED3D spec §5.3 flow 2): a wall drawn over the
// same segment as a wall of another sector offers a portal, which `setWallKind` makes on both sides. The toy level is a
// hall (0 to 8 m by 0 to 6 m) and a dock beside it (8 to 14 m), which already lead into each other.
import { describe, expect, it } from 'vitest'
import type { AfSector, AfSectorEntry } from '../format/af-sector.schema'
import type { Blockout, Room } from '../format/blockout.schema'
import { afSectorProfile } from '../profile/af-sector-profile'
import { lastLightProfile } from '../profile/last-light-profile'
import { toyAfSector, toyDock, toyHall } from '../testing/toy-af-sector'
import { toyBlockout, toyRoom } from '../testing/toy-blockout'
import { portalOffers } from './portal-offers'

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

  it('does the same on a Last Light level', () => {
    const c: Room = {
      ...toyRoom('a'),
      id: 'c',
      corners: [
        [-4, 0],
        [0, 0],
        [0, 4],
        [-4, 4],
      ],
    }
    const blockout: Blockout = toyBlockout({ rooms: [toyRoom('a'), toyRoom('b'), c] })
    expect(portalOffers(lastLightProfile, blockout, 'c')).toEqual([
      { sector: 'c', corner: 1, to: 'a', toCorner: 3, length: 4 },
    ])
  })
})
