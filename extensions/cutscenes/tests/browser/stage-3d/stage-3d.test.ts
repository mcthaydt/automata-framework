import { doorOpen, lampState, type PieceStates } from '@automata/3d/level'
import { expect, test } from 'vitest'
import { cutsceneStage3d } from '#src/features/stage-3d/cutscene-stage-3d.ts'
import { DOOR, DOOR_AND_LAMP, LAMP } from '#src/testing/door-and-lamp.ts'

// The room with a lamp and a door, drawn through the 3D stage for its six seconds on an injected clock, in each engine: the
// door ends open, the lamp ends as built, the camera ends on its last key, and the sound played once. The stage keeps no
// clock of its own, so the frames are the same in every engine.

test('draws the door-and-lamp scene for its 6 s on an injected clock', () => {
  let states: PieceStates | undefined
  let pose: { pos: readonly number[]; lens: number } | undefined
  const sounds: string[] = []
  const stage = cutsceneStage3d({
    camera: {
      set: (p) => {
        pose = p
      },
      release: () => {},
    },
    pieces: (s) => {
      states = s
    },
    actor: () => undefined,
    fade: () => {},
    sound: (kind) => void sounds.push(kind),
  })
  stage.start(DOOR_AND_LAMP)
  const tickHz = 60
  for (let tick = 0; tick <= 6 * tickHz; tick += 1) stage.draw(tick / tickHz)
  expect(doorOpen(states as PieceStates, DOOR)).toBe(1)
  expect(lampState(states as PieceStates, LAMP).level).toBe(1)
  expect(pose?.pos).toEqual([1.8, 1.9, 0.6])
  expect(pose?.lens).toBeCloseTo(24, 6)
  expect(sounds).toEqual(['creak'])
  stage.end()
  expect(stage.playing).toBe(false)
})
