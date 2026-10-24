// `@af-examples/base-2d/render`: the base's Pixi renderer, for demos that draw on top of the room. A separate
// entry from the package root, so code that only needs the sim or the palette never loads Pixi.

export { lightTexture, textureFromPixels } from './pixels.ts'
export { createRenderer, type Renderer, type RendererLayer } from './renderer.ts'
