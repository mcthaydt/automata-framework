// base-3d's systems and their order. Sim code: `pnpm boundaries` checks every file in src/. A tick runs: the camera's
// turn (render-pixi3d, input), the stick and the roll button copied onto Wick (input), Wick moved through the heading
// and rolled (physics), then the room's view entered and the embers taken (postPhysics).
export { type Area, type AreaSource, areaOf, compileArea, viewAt } from './area.ts'
export { emberTake } from './embers.ts'
export { heroInput, heroMove, heroView } from './hero.ts'
