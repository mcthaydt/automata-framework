import { type CameraView, cameraView } from '@automata/3d/sim'

// The numbers the game is built from, which both the sim and the screen read.

/** Fixed steps a second: the sim's default, which the page runs at. */
export const TICK_HZ = 60

/** The play camera: 50 mm, 30 degrees down, following the player, turned in 45 degree steps (DESIGN.md, camera). */
export const FOLLOW: CameraView = cameraView('follow')
