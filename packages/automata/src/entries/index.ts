// @mcthaydt/automata: the one import. What a game imports (`defineGame`, `startGame`, the sim's
// define verbs, input, draw), and the runtime, host contract, renderer and ui kit a game can reach for when it
// needs more than the defaults. Plus extensions are separate imports and never come through here.
//
// What a game and the 3D and editor packages import (task 6.4 cut this from every old package's surface to the names
// something in the repository imports, plus the define verbs and the types `defineGame` takes). The host contract
// comes whole: it is the vocabulary every distribution target shares.
export * from './from-automata.ts'
export * from './from-host.ts'
export * from './from-render-pixi.ts'
export * from './from-runtime.ts'
export * from './from-ui.ts'
