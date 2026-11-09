import { describe, expect, it } from 'vitest'
import { aimOf } from '#src/features/camera/camera-pose.ts'

const eye = { x: 0, y: 2, z: 0 }

describe('where a camera looks, as the sky wants it', () => {
  it('is straight ahead for a camera looking level toward +z', () => {
    const aim = aimOf(eye, { x: 0, y: 2, z: 5 })
    expect(aim.yaw).toBeCloseTo(0, 6)
    expect(aim.pitch).toBeCloseTo(0, 6)
  })

  it('turns right as the camera turns right: the bearing grows to the camera’s right (-x when it looks toward +z)', () => {
    expect(aimOf(eye, { x: -5, y: 2, z: 5 }).yaw).toBeCloseTo(Math.PI / 4, 6)
    expect(aimOf(eye, { x: 5, y: 2, z: 5 }).yaw).toBeCloseTo(-Math.PI / 4, 6)
  })

  it('pitches up positive, down negative', () => {
    expect(aimOf(eye, { x: 0, y: 7, z: 5 }).pitch).toBeCloseTo(Math.PI / 4, 6)
    expect(aimOf(eye, { x: 0, y: -3, z: 5 }).pitch).toBeCloseTo(-Math.atan2(5, 5), 6)
  })
})
