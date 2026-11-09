// `@af-games/emberwick`: what demos reuse from the base instead of copying it (examples/README.md). It stays
// free of Pixi: the game is `./game`, the renderer `./render`, and the sim plugin alone `./sim`.

export { type BaseSimOptions, createBaseSim, moveCommand, readPlayer } from '../app/base-sim.ts'
export { duel } from '../shared/art/palette.ts'
export { ALL_SPRITES, type PixelSprite } from '../shared/art/sprites.ts'
export { GAME_ID } from '../shared/game-id.ts'
export { parseRoom, type Room, type RoomSource } from '../shared/room.ts'
export * from './sim.ts'
