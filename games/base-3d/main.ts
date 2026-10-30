// games/base-3d: AF's 3D base game, The Cold Kiln (games/base-3d/DESIGN.md), Emberwick's 3D counterpart.
//
// Shows (M3.7a): the first slice's sim on `startGame` with the default screens: Wick walks the hall and the kiln
// relative to the camera's heading. Nothing is drawn yet; M3.7b adds the 3D scene.
// Controls: WASD or the arrows to move, Escape to pause.
// Packages: @mcthaydt/automata-game, @mcthaydt/automata-sim, @mcthaydt/automata-render-pixi3d (its sim entry);
// @mcthaydt/automata-ship for packaging.
import '@mcthaydt/automata-game/no-eval'
import { startGame } from '@mcthaydt/automata-game'
import { base3d } from './game.ts'

startGame(base3d)
