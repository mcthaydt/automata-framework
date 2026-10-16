// The base-2d sim plugin and its definitions. Checked by check-boundaries (game-ci `sim-roots: src/sim`).
export { base2dPlugin } from './base-2d.plugin.ts'
export { Move, type MoveInput } from './move.command.ts'
export { Player, PlayerControl } from './player.component.ts'
export { GoalReached, Jumped, Landed } from './player.event.ts'
export { Progress } from './progress.resource.ts'
export { hitsSolid, isSolid, type RoomGrid, type TilePosition } from './tiles.ts'
export * as tuning from './tuning.ts'
