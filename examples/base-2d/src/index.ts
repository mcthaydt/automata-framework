// `@af-examples/base-2d`: what demos reuse from the base instead of copying it (examples/README.md).

export { ENDESGA_64, endesga } from './art/palette.ts'
export { ALL_SPRITES, type PixelSprite } from './art/sprites.ts'
export { type BaseSimOptions, createBaseSim, moveCommand, readPlayer } from './base-sim.ts'
export { connect, GAME_ID } from './boot.ts'
export { parseRoom, ROOM, type Room, type RoomSource } from './content/room.ts'
export { type FlowEvent, next, type Screen } from './flow.ts'
export { createLoop, type Loop, type LoopOptions } from './loop.ts'
export * from './sim/index.ts'
