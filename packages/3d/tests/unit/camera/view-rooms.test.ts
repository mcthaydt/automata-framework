// A camera view's `rooms`: the sectors drawn while the view is active. Absent means every room; a view that draws none is not
// one, so it is refused in words; the other fields and the strictness are as before.
import { describe, expect, it } from 'vitest'
import { cameraView, cameraViewSchema } from '#src/features/camera/sim/camera-view.schema.ts'

describe('a camera view’s rooms', () => {
  it('are kept as written', () => {
    expect(cameraView('hall', { rooms: ['ward', 'bay'] }).rooms).toEqual(['ward', 'bay'])
  })

  it('are absent when the view says none, so it draws every room', () => {
    expect(cameraView('hall').rooms).toBeUndefined()
    expect('rooms' in cameraView('hall')).toBe(false)
  })

  it('refuses an empty list, in words that say what to do', () => {
    const result = cameraViewSchema.safeParse({ rooms: [] })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['rooms'])
    expect(result.error?.issues[0]?.message).toContain('leave `rooms` out')
  })

  it('refuses anything but sector ids', () => {
    expect(cameraViewSchema.safeParse({ rooms: [1] }).success).toBe(false)
    expect(cameraViewSchema.safeParse({ rooms: 'ward' }).success).toBe(false)
  })

  it('still refuses a field it does not know', () => {
    expect(cameraViewSchema.safeParse({ room: ['ward'] }).success).toBe(false)
  })

  it('leave every other field’s default alone', () => {
    const view = cameraView('hall', { rooms: ['ward'] })
    expect(view).toMatchObject({ tiltDeg: 30, distance: 16, follow: 1, rotate: true })
  })
})
