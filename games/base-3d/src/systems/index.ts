// base-3d's systems and their order (DESIGN.md §3.1). Sim code: `pnpm boundaries` checks every file in src/.
// A tick runs: the camera's turn (render-pixi3d, input), the stick and lock copied onto Wick and hitstop counted
// (input; a frozen tick stops every other system here), the lock target held, chosen or cycled and the heading
// assist, the action buttons' presses, the fighters' clocks and moves, the ember taken by a pickup beside it
// (prePhysics), Wick moved through the heading (physics), an exit taken or the area swapped after its fade, then
// the room's view entered (postPhysics), and the tick's hits gathered and landed (gameplay).
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
export { spawnFoes } from './area-foes.ts'
export { combatFreeze, combatHits, combatMoves, combatStatus } from './combat.ts'
export { dropsTake } from './drops.ts'
export { emberTake } from './embers.ts'
export { enemyBrain } from './enemies.ts'
export { heroAct, heroInput, heroMove, heroView } from './hero.ts'
export { bombFuse, chainFly, itemUse, pelletFly } from './items.ts'
export { lockAssist, lockSelect } from './lock-on.ts'
