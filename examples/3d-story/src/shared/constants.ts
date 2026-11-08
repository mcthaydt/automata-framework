import { type CameraView, cameraView } from '@automata/3d/sim'

// The numbers the game is built from. Both the sim and the screen read them, so they live here. How fast Wick walks is
// not here: a designer changes it, in content/tuning.toml.

/** Fixed steps a second: the sim's default, which the page runs at. */
export const TICK_HZ = 60

/** Half the side of the square Wick collides as, in metres. */
export const WICK_HALF = 0.3

/** The camera: 24 mm, 25 degrees down and 5 m back, following Wick, turned freely by the player. */
export const FOLLOW: CameraView = cameraView('follow')
