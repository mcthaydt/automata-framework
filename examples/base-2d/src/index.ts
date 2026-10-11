// `@af-examples/base-2d`: what demos reuse from the base instead of copying it (examples/README.md). It stays
// free of Pixi: the game is `./game`, the renderer `./render`, and the sim plugin alone `./sim`.

export { ENDESGA_64, endesga } from './art/palette.ts'
export { ALL_SPRITES, type PixelSprite } from './art/sprites.ts'
export { type BaseSimOptions, createBaseSim, moveCommand, readPlayer } from './base-sim.ts'
export { BaseBootFailed, connect, GAME_ID } from './boot.ts'
export {
  bootFailureMessage,
  CONNECT_FAILED,
  DEVICE_FAILED,
  RendererFailed,
  SimFailed,
} from './boot-failure.ts'
export { type BootPageParts, bootPage } from './boot-page.ts'
export {
  BASE_SIM_CONTENT,
  parseRoom,
  ROOM,
  type Room,
  type RoomSource,
  readRoomGrid,
} from './content/room.ts'
export { type FlowEvent, next, type Screen } from './flow.ts'
export { createLoop, type Loop, type LoopOptions } from './loop.ts'
export * from './sim/index.ts'
