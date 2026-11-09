// `@automata/framework/testing`: the helpers a game's or an extension's own tests use: a fake host and its contract
// suite, a null renderer and manual frames for the runtime, viewport and layout fixtures, the layout contract for a
// game's screens, and the unit-test fake gamepads. Product code never imports this file or `../testing/`.

export * from '../testing/host/contract-suite.ts'
export * from '../testing/host/index.ts'
export * from '../testing/input/fake-gamepads.ts'
export * from '../testing/runtime/index.ts'
export * from '../testing/ui/index.ts'
export * from './testing-fixtures.ts'
