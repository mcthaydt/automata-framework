// The 3D stage hands each part of the director's scene to the option that owns it. It holds no time of its own: the caller
// passes the sim's cutscene clock, so a replay draws the same frames.
import { doorOpen, lampState, type PieceStates } from '@automataframework/3d/level'
import { describe, expect, it } from 'vitest'
import { cutsceneStage3d } from '#src/features/stage-3d/cutscene-stage-3d.ts'
import { DOOR, DOOR_AND_LAMP, LAMP } from '#src/testing/door-and-lamp.ts'

/** What the stage called, in order, as strings a test can read. */
function fakes() {
  const calls: string[] = []
  const poses: { pos: readonly number[]; look: readonly number[]; lens: number }[] = []
  const pieces: PieceStates[] = []
  const placed: { who: string; x: number; z: number; moving: boolean }[] = []
  const fades: number[] = []
  const sounds: string[] = []
  const actor = (who: string) => ({
    place: (at: { x: number; z: number }) => void placed.push({ who, x: at.x, z: at.z, moving: false }),
    pose: (_name: string | undefined, moving: boolean) => {
      const last = placed[placed.length - 1]
      if (last !== undefined) last.moving = moving
    },
    alpha: () => {},
    clip: (name: string, at: number) => void calls.push(`clip ${who} ${name} ${at}`),
  })
  const options = {
    camera: {
      set: (pose: { pos: readonly number[]; look: readonly number[]; lens: number }) => void poses.push(pose),
      release: () => void calls.push('release'),
    },
    pieces: (states: PieceStates) => void pieces.push(states),
    actor: (who: string) => (who === 'ada' ? actor(who) : undefined),
    fade: (value: number) => void fades.push(value),
    sound: (kind: string) => void sounds.push(kind),
  }
  return { calls, poses, pieces, placed, fades, sounds, options }
}

describe('the 3D camera stage', () => {
  it('hands the director’s camera at 0, 3 and 6 seconds to the game’s camera', () => {
    const f = fakes()
    const stage = cutsceneStage3d(f.options)
    stage.start(DOOR_AND_LAMP)
    for (const t of [0, 3, 6]) stage.draw(t)
    expect(f.poses).toHaveLength(3)
    expect(f.poses[0]?.pos).toEqual([2.8, 1.7, 2.4])
    expect(f.poses[2]?.pos).toEqual([1.8, 1.9, 0.6])
    // The script's lens is 24 mm: a field of view of 53.1° is 24 mm on a 24 mm frame.
    expect(f.poses[0]?.lens).toBeCloseTo(24, 6)
    // At 3 s the camera is half way between its two keys (the keys ease, so not exactly the middle).
    expect(f.poses[1]?.pos[0]).toBeGreaterThan(1.8)
    expect(f.poses[1]?.pos[0]).toBeLessThan(2.8)
  })

  it('sets the lamp’s level and the door’s opening through the pieces', () => {
    const f = fakes()
    const stage = cutsceneStage3d(f.options)
    stage.start(DOOR_AND_LAMP)
    stage.draw(0)
    stage.draw(6)
    expect(lampState(f.pieces[0] as PieceStates, LAMP).level).toBeCloseTo(0.1, 6)
    expect(lampState(f.pieces[1] as PieceStates, LAMP).level).toBe(1)
    expect(doorOpen(f.pieces[0] as PieceStates, DOOR)).toBe(0)
    expect(doorOpen(f.pieces[1] as PieceStates, DOOR)).toBe(1)
  })

  it('places an actor the script has and ignores one the game has no view for', () => {
    const f = fakes()
    const stage = cutsceneStage3d(f.options)
    stage.start({
      ...DOOR_AND_LAMP,
      actor: [...(DOOR_AND_LAMP.actor ?? []), { who: 'ghost', t: 0, x: 0, z: 0, moving: false }],
    })
    stage.draw(0)
    expect(f.placed).toEqual([{ who: 'ada', x: 1, z: 1, moving: false }])
  })

  it('plays a sound key once, even when drawn twice for the same moment', () => {
    const f = fakes()
    const stage = cutsceneStage3d(f.options)
    stage.start(DOOR_AND_LAMP)
    stage.draw(2.9)
    expect(f.sounds).toEqual([])
    stage.draw(3.1)
    stage.draw(3.1)
    stage.draw(4)
    expect(f.sounds).toEqual(['creak'])
  })

  it('plays it again when the scene is wound back past it', () => {
    const f = fakes()
    const stage = cutsceneStage3d(f.options)
    stage.start(DOOR_AND_LAMP)
    stage.draw(4)
    stage.draw(1)
    stage.draw(4)
    expect(f.sounds).toEqual(['creak', 'creak'])
  })

  it('starts the clips of the script’s cues on the actor’s view, once', () => {
    const f = fakes()
    const stage = cutsceneStage3d(f.options)
    stage.start({ ...DOOR_AND_LAMP, cues: [{ at: 1, who: 'ada', clip: 'turn' }] })
    stage.draw(0.5)
    stage.draw(1.5)
    stage.draw(1.5)
    expect(f.calls.filter((c) => c.startsWith('clip'))).toEqual(['clip ada turn 1'])
  })

  it('is playing between start and end, and end gives the camera back and clears the fade', () => {
    const f = fakes()
    const stage = cutsceneStage3d(f.options)
    expect(stage.playing).toBe(false)
    stage.start(DOOR_AND_LAMP)
    expect(stage.playing).toBe(true)
    stage.draw(1)
    stage.end()
    expect(stage.playing).toBe(false)
    expect(f.calls).toContain('release')
    expect(f.fades[f.fades.length - 1]).toBe(0)
  })

  it('puts the pieces back as the game says on end, when it says', () => {
    const f = fakes()
    const own: PieceStates = { doors: { [DOOR]: 0.5 }, lamps: {}, props: {} }
    const stage = cutsceneStage3d({ ...f.options, restore: () => own })
    stage.start(DOOR_AND_LAMP)
    stage.draw(6)
    stage.end()
    expect(f.pieces[f.pieces.length - 1]).toBe(own)
  })

  it('draws nothing when it is not playing', () => {
    const f = fakes()
    const stage = cutsceneStage3d(f.options)
    stage.draw(1)
    expect(f.poses).toEqual([])
  })
})
