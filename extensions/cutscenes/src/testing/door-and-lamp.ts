// A scene of the extension's own for its 3D stage: a room with a lamp and a door. The camera drifts in, the lamp warms from
// nearly out to as built, the door opens, and a sound is heard once as the door starts to move. Tests only.
import type { PlacedScript } from '../shared/sim/anchors'

export const LAMP = 'lamp'
export const DOOR = 'doorway'

export const DOOR_AND_LAMP: PlacedScript = {
  id: 'door-and-lamp',
  duration: 6,
  lens: 24,
  camera: [
    { t: 0, pos: [2.8, 1.7, 2.4], look: [-0.2, 1, -1] },
    { t: 6, pos: [1.8, 1.9, 0.6], look: [-0.1, 1, -2.4] },
  ],
  light: [
    { t: 0, lamp: LAMP, level: 0.1 },
    { t: 3, lamp: LAMP, level: 1 },
  ],
  doors: [
    { t: 3, door: DOOR, open: 0 },
    { t: 5, door: DOOR, open: 1 },
  ],
  actor: [
    { who: 'ada', t: 0, x: 1, z: 1, facing: 0, moving: false },
    { who: 'ada', t: 6, x: 1, z: -1, facing: 0, moving: true },
  ],
  sound: [{ t: 3, kind: 'creak' }],
}
