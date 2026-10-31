// base-3d's systems and their order (DESIGN.md §3.1). Sim code: `pnpm boundaries` checks every file in src/.
// A tick runs: the camera's turn (render-pixi3d, input), the stick and lock copied onto Wick (input), the lock
// target held or chosen, the action buttons' presses, the ember taken by a pickup beside it (prePhysics), Wick moved through the heading (physics), an exit taken or
// the area swapped after its fade, then the room's view entered (postPhysics).
export {
  type Area,
  type AreaSource,
  areaOf,
  compileArea,
  compileWorld,
  viewAt,
  type World,
} from './area.ts'
export { areaExit } from './area-exit.ts'
export { emberTake } from './embers.ts'
export { heroAct, heroInput, heroMove, heroView } from './hero.ts'
export { lockSelect } from './lock-on.ts'
