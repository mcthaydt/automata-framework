import { describe, expect, it } from 'vitest'
import { BlockoutError, expand } from './expand'
import { DOORWAY, ROOM_A, ROOM_B, TOY } from './toy-blockout'

// The openings and nav cases of the expansion (the shipped-file comparisons stay with the editor's fixtures).
describe('expand', () => {
  it('splits both walls and adds the connector, north-west corner first', () => {
    const expanded = expand(TOY)
    expect(expanded.sectors.map((sector) => sector.id)).toEqual(['a', 'b', 'ab'])
    expect(expanded.sectors[0]?.corners).toEqual([
      [0, 0],
      [4, 0],
      [4, 1.5, { next: 'ab' }],
      [4, 2.5],
      [4, 4],
      [0, 4],
    ])
    expect(expanded.sectors[1]?.corners).toEqual([
      [4.125, 0],
      [7, 0],
      [7, 4],
      [4.125, 4],
      [4.125, 2.5, { next: 'ab' }],
      [4.125, 1.5],
    ])
    expect(expanded.sectors[2]).toEqual({
      id: 'ab',
      zone: 'a',
      floor: 0,
      ceiling: 2.1,
      light: 1,
      corners: [
        [4, 1.5],
        [4.125, 1.5, { next: 'b' }],
        [4.125, 2.5],
        [4, 2.5, { next: 'a' }],
      ],
    })
  })

  it('derives a connected nav graph that crosses the opening through its door', () => {
    const expanded = expand(TOY)
    expect(Object.keys(expanded.nodes)).toEqual(['a', 'b', 'ab:a', 'ab:b'])
    expect(expanded.edges).toEqual([
      ['a', 'ab:a'],
      ['b', 'ab:b'],
      ['ab:a', 'ab:b', 'abDoor'],
    ])
    expect(expanded.nodes['ab:a']).toEqual({ x: 3.5, z: 2 })
  })

  it('leaves a derived edge out when nav.drop names it, in either direction', () => {
    const dropped = expand({ ...TOY, nav: { drop: [['ab:b', 'b']] } })
    expect(dropped.edges).toEqual([
      ['a', 'ab:a'],
      ['ab:a', 'ab:b', 'abDoor'],
    ])
  })

  it('takes the nav the file writes by hand when derive is false, without the `on` attachments', () => {
    const byHand = expand({
      ...TOY,
      nav: {
        derive: false,
        nodes: { here: { x: 1, z: 1, on: 'box:abDoor' } },
        edges: [['here', 'here']],
        patrol: ['here'],
      },
    })
    expect(byHand.nodes).toEqual({ here: { x: 1, z: 1 } })
    expect(byHand.edges).toEqual([['here', 'here']])
    expect(byHand.patrol).toEqual(['here'])
  })

  it('drops the box role and the `on` attachment, the fields only the editor reads', () => {
    const expanded = expand({
      ...TOY,
      hotspots: [{ id: 'far', x: 6, y: 1, z: 3, name: 'Far wall', reach: 1.4, on: 'box:abDoor' }],
    })
    expect(expanded.boxes[0]).not.toHaveProperty('role')
    expect(expanded.hotspots[0]).not.toHaveProperty('on')
  })

  it('applies a style and a wall preset, and refuses a name the file does not define', () => {
    const styled = expand({
      ...TOY,
      styles: { COLD: { floorTexture: 'tile', trim: { skirting: 0.2 } } },
      walls: { GLASS: { mask: 'glass', block: true } },
      rooms: [
        {
          ...ROOM_A,
          style: 'COLD',
          corners: [
            [0, 0],
            [4, 0, { preset: 'GLASS', maskTop: 2 }],
            [4, 4],
            [0, 4],
          ],
        },
        ROOM_B,
      ],
      openings: [],
    })
    expect(styled.sectors[0]).toMatchObject({ floorTexture: 'tile', trim: { skirting: 0.2 } })
    expect(styled.sectors[0]?.corners[1]).toEqual([4, 0, { mask: 'glass', block: true, maskTop: 2 }])
    expect(() => expand({ ...TOY, rooms: [{ ...ROOM_A, style: 'NOPE' }], openings: [] })).toThrow(
      /unknown style NOPE/,
    )
    expect(() =>
      expand({
        ...TOY,
        rooms: [
          {
            ...ROOM_A,
            corners: [
              [0, 0, { preset: 'NOPE' }],
              [4, 0],
              [4, 4],
            ],
          },
        ],
        openings: [],
      }),
    ).toThrow(/unknown wall preset NOPE/)
  })

  it('refuses an opening no pair of facing walls covers', () => {
    const openings = [{ ...DOORWAY, span: [3.5, 4.5] as const }]
    expect(() => expand({ ...TOY, openings })).toThrow(BlockoutError)
    expect(() => expand({ ...TOY, openings })).toThrow(/no pair of facing/)
  })

  it('refuses an opening that names a room the file does not have', () => {
    expect(() => expand({ ...TOY, openings: [{ ...DOORWAY, to: 'z' }] })).toThrow(/unknown room z/)
  })
})
