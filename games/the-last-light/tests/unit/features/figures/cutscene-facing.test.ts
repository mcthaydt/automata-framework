import { beforeEach, describe, expect, it, vi } from 'vitest'

// A cutscene key `facing: 0` is the sim's heading 0, which faces +z, toward the play camera: the old game shows the face there. The
// painted view turns a pose by the kit's own zero (an entity yaw 0 faces -z), so the stage's facing has to cross the same
// conversion the sim's heading does. This drives the figure the way the cutscene director does and reads where the face points.

const poses: Array<{ yaw: number }> = []

vi.mock('@automata/character-kit', () => ({
  paintedFigure: () => () => ({
    container: { visible: true },
    update: (components: Readonly<Record<string, { yaw: number }>>) => {
      poses.push(components.pose as { yaw: number })
    },
  }),
}))

const { figureView } = await import('#src/features/figures/figure-view.ts')
const { adaMoving, adaYaw } = await import('#src/features/figures/figure-view.ts')

/** Where a painted figure faces on the plan for the yaw it is given: the kit's rule, an entity's yaw 0 faces -z and turns about up. */
const facingOf = (yaw: number) => ({ x: -Math.sin(yaw), z: -Math.cos(yaw) })

describe('a cutscene turns a painted figure the way the script says', () => {
  const actors = new Map<string, { place: (at: { x: number; z: number }, facing: number) => void }>()
  beforeEach(() => {
    poses.length = 0
    actors.clear()
    // biome-ignore lint/suspicious/noExplicitAny: the stage's actor map is typed by the cutscene package; this test needs only `place`
    const make = figureView(
      { def: {} as never, who: () => 'ada', yawOf: adaYaw, movingOf: adaMoving },
      actors as any,
    )
    make(
      { sid: 1, components: { ada: { yaw: Math.PI } } } as never,
      'pose',
      {} as never,
      {} as never,
      {} as never,
    )
    poses.length = 0
  })

  it('facing 0 shows the face to the play camera (+z), as the old game does', () => {
    actors.get('ada')?.place({ x: 0, z: 0 }, 0)
    const face = facingOf(poses.at(-1)?.yaw ?? Number.NaN)
    expect(face.x).toBeCloseTo(0)
    expect(face.z).toBeCloseTo(1)
  })

  it('facing pi shows her back to the play camera (-z)', () => {
    actors.get('ada')?.place({ x: 0, z: 0 }, Math.PI)
    const face = facingOf(poses.at(-1)?.yaw ?? Number.NaN)
    expect(face.x).toBeCloseTo(0)
    expect(face.z).toBeCloseTo(-1)
  })
})
