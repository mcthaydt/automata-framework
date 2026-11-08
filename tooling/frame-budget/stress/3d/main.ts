// tooling/frame-budget/stress/3d: the 3D look's stress scene (Wick walking a hall while the camera turns), the page
// the 3D frame-budget projects measure.
//
// Shows: the 3D renderer with the pixel-art look and every core pass on, a figure posed each frame, a turning camera.
// Controls: none
// It reports the first figure's pose time on `<html data-first-pose-ms>`, which the probe checks against the budget.
import '@automata/3d/no-eval'
import { startGame } from '@automata/framework'
import { stress3dGame } from './stress-3d-game.ts'

startGame(
  stress3dGame((ms) => {
    document.documentElement.dataset.firstPoseMs = String(ms)
  }),
)
