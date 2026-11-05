// @mcthaydt/automata: the one import (PRODUCT spec §7). What a game imports (`defineGame`, `startGame`, the sim's
// define verbs, input, draw), and the runtime, host contract, renderer and ui kit a game can reach for when it
// needs more than the defaults. Plus extensions are separate imports and never come through here.
//
// This is every old package's surface, side by side, so the move from nine packages to one changes no name a
// consumer imports. Task 6.4 (the surface) cuts it down to what a game and the 3D and editor packages use.
export * from './from-automata.ts'
// Two names the old packages each defined for different things. No consumer imports either by that name from the
// root; the host contract's `ErrorCode` and the runtime's `DisplayCopy` win, and the ui kit's `DisplayCopy`
// (the settings Display section's words) is left to task 6.4 (the surface) to rename or drop.
export type { ErrorCode } from './from-host.ts'
export * from './from-host.ts'
export * from './from-render-pixi.ts'
export type { DisplayCopy } from './from-runtime.ts'
export * from './from-runtime.ts'
export * from './from-ui.ts'
