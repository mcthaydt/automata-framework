import { describe, expect, it } from 'vitest'
import { interpolatePose3d } from './pose-3d.js'

describe('interpolatePose3d', () => {
  it('D3-d: at alpha 0.5 the position lies halfway between the last two ticks', () => {
    const prev = { x: 1, y: 0, z: -2, yaw: 0 }
    const curr = { x: 3, y: 1, z: 4, yaw: 0.5 }
    expect(interpolatePose3d(curr, prev, 0.5)).toEqual({ x: 2, y: 0.5, z: 1, yaw: 0.25 })
  })

  it('shows the previous tick at alpha 0 and the current tick exactly at alpha 1', () => {
    const prev = { x: 0.1, y: 0.2, z: 0.3, yaw: 0.4 }
    const curr = { x: 0.7, y: 0.9, z: 1.3, yaw: 1.1 }
    expect(interpolatePose3d(curr, prev, 0)).toEqual(prev)
    expect(interpolatePose3d(curr, prev, 1)).toEqual(curr)
  })

  it('turns the yaw by the shorter arc', () => {
    const pose = interpolatePose3d({ yaw: -Math.PI + 0.1 }, { yaw: Math.PI - 0.1 }, 0.5)
    expect(Math.abs(Math.abs(pose.yaw) - Math.PI)).toBeLessThan(1e-12)
  })

  it('is the current pose with no previous tick, and reads missing or non-numeric fields as 0', () => {
    expect(interpolatePose3d({ x: 2, z: 'far' }, undefined, 0.5)).toEqual({ x: 2, y: 0, z: 0, yaw: 0 })
  })
})
