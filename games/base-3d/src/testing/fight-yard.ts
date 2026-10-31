// The fights golden's area (GAME-3D.1d, G3-b's two fights until GAME-3D.1i authors D1 and D2): one walled yard with a
// Sootling near the entrance and an Ash Knight beyond it. Test content, in metres.
import type { AreaSource } from '../systems/index.ts'

const WALL = 0.2

export const FIGHT_YARD: AreaSource = {
  id: 'fight-yard',
  spawn: { x: 0, z: -4 },
  views: [{ id: 'yard', yawDeg: 0, bounds: { min: [-6, 0, -6], max: [6, 2, 6] } }],
  rooms: [{ view: 'yard', min: [-6, -6], max: [6, 6] }],
  walls: [
    { min: [-6 - WALL, -6 - WALL], max: [6 + WALL, -6] },
    { min: [-6 - WALL, 6], max: [6 + WALL, 6 + WALL] },
    { min: [-6 - WALL, -6], max: [-6, 6] },
    { min: [6, -6], max: [6 + WALL, 6] },
  ],
  targets: [],
  ember: { x: 5, z: 5 },
  foes: [
    { kind: 'sootling', x: -1.5, z: -1, facing: 180 },
    { kind: 'ash-knight', x: 2, z: 4, facing: 180 },
  ],
}
