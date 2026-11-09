import { describe, expect, it } from 'vitest'
import { intoView } from '#src/features/look/passes/shafts-effect.ts'

const about = (axis: 'x' | 'y', angle: number) => ({
  x: axis === 'x' ? Math.sin(angle / 2) : 0,
  y: axis === 'y' ? Math.sin(angle / 2) : 0,
  z: 0,
  w: Math.cos(angle / 2),
})

describe('a world direction as a camera sees it', () => {
  it('is the same for a camera that has not turned', () => {
    expect(intoView({ x: 0, y: 0, z: 0, w: 1 }, [1, 2, 3])).toEqual([1, 2, 3])
  })

  it('puts what lies straight ahead on the camera’s -z, however it has turned about the vertical', () => {
    // A camera turned 90° left looks along -x: a point 5 m along -x is 5 m ahead.
    const [x, y, z] = intoView(about('y', Math.PI / 2), [-5, 0, 0])
    expect(x).toBeCloseTo(0, 6)
    expect(y).toBeCloseTo(0, 6)
    expect(z).toBeCloseTo(-5, 6)
  })

  it('sees straight down as down when the camera looks level, and keeps lengths', () => {
    const [x, y, z] = intoView(about('x', (-30 * Math.PI) / 180), [0, -1, 0])
    expect(Math.hypot(x, y, z)).toBeCloseTo(1, 6)
    // Tipped down 30°, the camera's down is 30° off its own -y toward its -z.
    expect(y).toBeCloseTo(-Math.cos((30 * Math.PI) / 180), 6)
    expect(z).toBeCloseTo(-Math.sin((30 * Math.PI) / 180), 6)
  })
})
