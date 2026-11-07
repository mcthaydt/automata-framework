// `@af-games/emberwick/render`: the base's Pixi renderer, for demos that draw on top of the room. A separate
// entry from the package root, so code that only needs the sim or the palette never loads Pixi.

export { lightTexture, textureFromPixels } from '../shared/pixels.ts'
