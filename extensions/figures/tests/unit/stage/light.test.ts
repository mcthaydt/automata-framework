// biome-ignore-all lint/style/noNonNullAssertion: the compiler needs these assertions until task 27 of the builders-fold plan (the strict flags) replaces each with a check
import { describe, expect, it } from 'vitest'
import {
  type FigureLight,
  lightFigure,
  lightSprite,
  ScriptedActor,
  SPRITE_PITCH,
  type SpriteLighting,
  TIMES,
  type V3,
} from '#src/entries/index.ts'
import { lookAt, viewOf } from '#src/shared/stage/pose.ts'
import { stageFrame } from '#src/shared/stage/stage.ts'
import { registerFixtures } from '../paint/fabric-fixtures'
import { DENIM_DEF, md5, ortho } from './fixtures'

/** Light through the stage: world lamps, the light hook and a fabric (src/shared/stage/stage.ts). */
const deg = Math.PI / 180
const actor = (who: string, at: [number, number]) => new ScriptedActor({ who, at })
const NIGHT = {
  time: TIMES.night,
  lamps: [{ at: [-1.2, 1.5, 0.8] as V3, color: '#ffbc4e', steps: 3, radius: 3.2 }],
}

describe('stageFrame lights', () => {
  it('a world lamp lights an actor where it stands, as lightFigure does with `at` there', () => {
    const a = actor('base-m', [1.5, -2]),
      s = stageFrame([a], 0, ortho(2, [512, 384]), { lighting: NIGHT }).sprites[0]
    const f = actor('base-m', [1.5, -2]).draw(0, { azimuth: 0, pitch: 18 * deg }, 2)
    expect(md5(s.cell.rgba)).toBe(md5(lightFigure(f, { ...NIGHT, at: [1.5, 0, -2] })))
    expect(md5(s.cell.painted)).toBe(md5(f.painted))
  })
  it('moving the eye a quarter turn round the figure turns the lamp with the world', () => {
    // a lamp on world +x; seen from +x (azimuth 90°) it stands toward the camera: the figure's lighting frame +z
    const lamp = { ...NIGHT.lamps[0], at: [2, 1.5, 0] as V3 },
      side = lookAt([20, 6, 0], [0, 1, 0], { pixelsPerMetre: (2 * 96) / 2.6 }, [512, 384])
    const s = stageFrame([actor('base-m', [0, 0])], 0, side, {
      lighting: { time: TIMES.night, lamps: [lamp] },
    }).sprites[0]
    const f = actor('base-m', [0, 0]).draw(0, { ...viewOf(side, [0, 0, 0]), pitch: SPRITE_PITCH }, 2) // the renders' pitch, not the camera's
    expect(md5(s.cell.rgba)).toBe(
      md5(lightFigure(f, { time: TIMES.night, lamps: [{ ...lamp, at: [0, 1.5, 2] }], at: [0, 0, 0] })),
    )
  })
  it("a spot's aim turns with the world too", () => {
    const lamp = { ...NIGHT.lamps[0], at: [2, 1.5, 0] as V3, aim: [-1, -0.2, 0] as V3, cone: 40 },
      side = lookAt([20, 6, 0], [0, 1, 0], { pixelsPerMetre: (2 * 96) / 2.6 }, [512, 384])
    const s = stageFrame([actor('base-m', [0, 0])], 0, side, {
      lighting: { time: TIMES.night, lamps: [lamp] },
    }).sprites[0]
    const f = actor('base-m', [0, 0]).draw(0, { ...viewOf(side, [0, 0, 0]), pitch: SPRITE_PITCH }, 2)
    expect(md5(s.cell.rgba)).toBe(
      md5(
        lightFigure(f, {
          time: TIMES.night,
          lamps: [{ ...lamp, at: [0, 1.5, 2], aim: [0, -0.2, -1] }],
          at: [0, 0, 0],
        }),
      ),
    )
  })
  it('the light hook reaches the painter and no lightFigure runs', () => {
    const hook: FigureLight = () => [1.4, 0.6, 0.6]
    const s = stageFrame([actor('base-m', [0, 0])], 0, ortho(2, [128, 192]), { lights: () => hook })
      .sprites[0]
    const f = actor('base-m', [0, 0]).draw(0, { azimuth: 0, pitch: 18 * deg }, 2, hook)
    expect(md5(s.cell.rgba)).toBe(md5(f.painted))
    expect(s.cell.rgba).toBe(s.cell.painted)
    expect(md5(s.cell.rgba)).not.toBe(
      md5(actor('base-m', [0, 0]).draw(0, { azimuth: 0, pitch: 18 * deg }, 2).painted),
    )
  })
  it('a tiled cloth is lit through its weave', () => {
    registerFixtures()
    const s = stageFrame([new ScriptedActor({ who: DENIM_DEF, at: [0.5, -1] })], 0, ortho(2, [512, 384]), {
      lighting: NIGHT,
    }).sprites[0]
    const f = new ScriptedActor({ who: DENIM_DEF, at: [0.5, -1] }).draw(0, { azimuth: 0, pitch: 18 * deg }, 2)
    expect(s.cell.weave).not.toBeNull()
    expect(md5(s.cell.rgba)).toBe(md5(lightFigure(f, { ...NIGHT, at: [0.5, 0, -1] })))
  })
  it('refuses more than one light path at once', () => {
    const three = /lighting, lights and sprite are three light paths; give one/,
      sprite = () => null
    expect(() => stageFrame([], 0, ortho(1, [64, 96]), { lighting: NIGHT, lights: () => null })).toThrow(
      three,
    )
    expect(() => stageFrame([], 0, ortho(1, [64, 96]), { lighting: NIGHT, sprite })).toThrow(three)
    expect(() => stageFrame([], 0, ortho(1, [64, 96]), { lights: () => null, sprite })).toThrow(three)
  })
})

describe('stageFrame sprite light', () => {
  /** A warm lamp in the world on +x, strength 0.8, and the light where the figure stands. */
  const room = (dir: V3): SpriteLighting => ({ flat: [1.3, 1.1, 0.8], lamps: [{ dir, strength: 0.8 }] })
  it("lights the cell with the sprite light, the lamp turned into the actor's frame; painted stays unlit", () => {
    // seen from +x (azimuth 90°) a lamp on world +x is toward the camera: the lighting frame's +z
    const side = lookAt([20, 6, 0], [0, 1, 0], { pixelsPerMetre: (2 * 96) / 2.6 }, [512, 384])
    const seen: { who: string; at: V3 }[] = []
    const s = stageFrame([actor('base-m', [0, 0])], 0, side, {
      sprite: (a, at) => {
        seen.push({ who: a.name, at })
        return room([1, 0, 0])
      },
    }).sprites[0]
    const f = actor('base-m', [0, 0]).draw(0, { ...viewOf(side, [0, 0, 0]), pitch: SPRITE_PITCH }, 2)
    expect(seen).toHaveLength(1)
    expect(seen[0].at).toEqual([0, 0, 0])
    expect(md5(s.cell.rgba)).toBe(md5(lightSprite(f, room([0, 0, 1]))))
    expect(md5(s.cell.painted)).toBe(md5(f.painted))
    const unlit = stageFrame([actor('base-m', [0, 0])], 0, side).sprites[0]
    expect(s.cell.key).not.toBe(unlit.cell.key)
    expect(md5(s.cell.rgba)).not.toBe(md5(unlit.cell.rgba))
  })
  it("is given the actor's feet in the world", () => {
    let at: V3 | null = null
    stageFrame([actor('base-m', [1.5, -2])], 0, ortho(2, [512, 384]), {
      sprite: (_, p) => {
        at = p
        return null
      },
    })
    expect(at).toEqual([1.5, 0, -2])
  })
  it('null leaves that actor unlit', () => {
    const lit = stageFrame([actor('base-m', [0, 0]), actor('base-f', [1, 0])], 0, ortho(2, [512, 384]), {
      sprite: (a) => (a.name === 'base-m' ? null : room([0, 0, 1])),
    }).sprites
    const plain = stageFrame(
      [actor('base-m', [0, 0]), actor('base-f', [1, 0])],
      0,
      ortho(2, [512, 384]),
    ).sprites
    const by = (list: typeof lit, who: string) => list.find((x) => x.name === who)!
    expect(by(lit, 'base-m').cell.key).toBe(by(plain, 'base-m').cell.key)
    expect(md5(by(lit, 'base-m').cell.rgba)).toBe(md5(by(plain, 'base-m').cell.rgba))
    expect(md5(by(lit, 'base-f').cell.rgba)).not.toBe(md5(by(plain, 'base-f').cell.rgba))
  })
})
