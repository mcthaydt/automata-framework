// `@af-examples/base-2d`: what demos reuse from the base instead of copying it (examples/README.md). It stays
// free of Pixi: the game is `./game`, the renderer `./render`, and the sim plugin alone `./sim`.

export { ENDESGA_64, endesga } from './art/palette.ts'
export { ALL_SPRITES, type PixelSprite } from './art/sprites.ts'
export { type BaseSimOptions, createBaseSim, moveCommand, readPlayer } from './base-sim.ts'
export { parseRoom, type Room, type RoomSource } from './content/room.ts'
export { GAME_ID } from './game-id.ts'
export * from './sim/index.ts'
