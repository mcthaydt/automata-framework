import { describe, expect, it } from 'vitest'
import { shadowInput } from '#src/features/painted/shadow-input.ts'

const cell = {
  key: '2x3:abc',
  size: [2, 3] as [number, number],
  rgba: new Uint8ClampedArray(2 * 3 * 4),
  anchor: [1, 3] as [number, number],
  metresPerTexel: 0.0135,
  pitch: 0.314,
}

describe('what a painted figure gives the room’s shadow', () => {
  it('is its cell’s picture: the texels, their size, the feet and the pitch, named by the cell’s key', () => {
    const input = shadowInput(cell, [1, 0, -2], [1, 0, 0])
    expect(input.silhouette).toEqual({
      key: '2x3:abc',
      width: 2,
      height: 3,
      rgba: cell.rgba,
      anchor: [1, 3],
      metresPerTexel: 0.0135,
      pitch: 0.314,
    })
    expect(input.at).toEqual([1, 0, -2])
  })

  it('takes the camera’s right as a horizontal unit vector: a camera that looks down has its right tilted, and only the floor part counts', () => {
    expect(shadowInput(cell, [0, 0, 0], [0, 0.7, 0.7]).right).toEqual([0, 1])
    const [x, z] = shadowInput(cell, [0, 0, 0], [3, 0.5, 4]).right
    expect([x, z]).toEqual([0.6, 0.8])
  })

  it('runs the grid along x when the camera’s right has no horizontal part', () => {
    expect(shadowInput(cell, [0, 0, 0], [0, 1, 0]).right).toEqual([1, 0])
  })
})
