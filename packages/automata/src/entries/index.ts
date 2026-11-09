// @automata/framework: the one import. What a game imports (`defineGame`, `startGame`, the sim's
// define verbs, input, draw), and the runtime, host contract, renderer and ui kit a game can reach for when it
// needs more than the defaults. Extensions are separate imports and never come through here.
//
// Each file below holds one part of the surface, trimmed to the names something in the repository imports, plus the
// define verbs and the types `defineGame` takes. The host contract comes whole: it is the vocabulary every
// distribution target shares.
export * from './game-and-sim.ts'
export * from './host-contract.ts'
export * from './render.ts'
export * from './runtime.ts'
export * from './ui.ts'
