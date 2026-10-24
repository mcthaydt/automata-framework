// The little vector arithmetic the camera and the 3D picking share (ED3D.4 steps 7 and 8). Triples in, triples out.
import { describe, expect, it } from 'vitest'
import { add, cross, dot, length, scale, sub, unit } from './vec3'

describe('vec3', () => {
  it('adds, subtracts and scales a component at a time', () => {
    expect(add([1, 2, 3], [10, 20, 30])).toEqual([11, 22, 33])
    expect(sub([10, 20, 30], [1, 2, 3])).toEqual([9, 18, 27])
    expect(scale([1, -2, 3], 2)).toEqual([2, -4, 6])
  })

  it('takes the dot product and the length', () => {
    expect(dot([1, 2, 3], [4, -5, 6])).toBe(12)
    expect(length([3, 4, 12])).toBe(13)
    expect(length([0, 0, 0])).toBe(0)
  })

  it('takes the cross product by the right-hand rule', () => {
    expect(cross([1, 0, 0], [0, 1, 0])).toEqual([0, 0, 1])
    expect(cross([0, 1, 0], [0, 0, 1])).toEqual([1, 0, 0])
    expect(cross([0, 0, 1], [1, 0, 0])).toEqual([0, 1, 0])
    expect(cross([0, 1, 0], [1, 0, 0])).toEqual([0, 0, -1])
    expect(cross([2, 3, 4], [5, 6, 7])).toEqual([-3, 6, -3])
  })

  it('makes a vector of length 1, and leaves the zero vector as it is', () => {
    expect(unit([0, 3, 4])).toEqual([0, 0.6, 0.8])
    expect(unit([0, 0, -7])).toEqual([0, 0, -1])
    expect(unit([0, 0, 0])).toEqual([0, 0, 0])
  })
})
