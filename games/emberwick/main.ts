// games/emberwick: AF's 2D base project, a character in a room.
//
// Shows: a complete small game on `startGame`. A pixel-art character runs and jumps through one single-screen
// room to an ember (Wick, a hooded lantern-bearer in mossy ruins at night, Endesga 64, lit by pixel lights),
// through splash → menu → room → pause → end. The runtime completes the Ruken handshake and draws nothing
// before the host says ready; opened directly, it runs standalone.
// Controls: arrows or A/D to move, Space, Z, W or Up to jump, Escape or P to pause; on-screen buttons on touch.
// Base: this is the 2D base. Demos build on it through `@af-examples/base-2d`.
// Packages: @mcthaydt/automata-game (runtime, render-pixi, host, ui), @mcthaydt/automata-sim, pixi.js,
// @fontsource/pixelify-sans (OFL font); @mcthaydt/automata-tools for packaging.
import '@mcthaydt/automata/no-eval'
import '@fontsource/pixelify-sans/latin-400.css'
import '@fontsource/pixelify-sans/latin-700.css'
import { startGame } from '@mcthaydt/automata'
import { emberwick } from './src/game.ts'

startGame(emberwick)
