// `@af-games/emberwick/sim`: the sim plugin and its definitions, without Pixi, for demos that add to the room's sim.
// Checked by `pnpm boundaries`, which finds the sim files by their role suffix and by what they import.
export { emberwickPlugin } from '../app/emberwick.plugin.ts'
export { Progress } from '../features/goal/progress.resource.ts'
export { Move, type MoveInput } from '../features/player/move.command.ts'
export { Player, PlayerControl } from '../shared/player.component.ts'
export { GoalReached, Jumped, Landed } from '../shared/player.event.ts'
export { hitsSolid, isSolid, type RoomGrid, type TilePosition } from '../shared/tiles.ts'
export * as tuning from '../shared/tuning.ts'
