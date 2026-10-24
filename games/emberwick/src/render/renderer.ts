import type { StepResult } from '@mcthaydt/automata-sim'
import { Application, type Container, TextureSource } from 'pixi.js'
import { endesga } from '../art/palette.ts'
import type { Room } from '../content/room.ts'
import { createScene, type RendererLayer } from './scene.ts'

// The scene on its own Pixi application, for the demos built on `playRoom` (play-room.ts). The game itself
// draws the same scene on render-pixi's stage (scene-renderer.ts). Set up the way FloorFifty sets up Pixi:
// WebGL preference (a WebGL2 context, AF's default), no antialiasing, nearest scaling, the room's own
// resolution (320 × 192) scaled up whole pixels at a time. Goes when the demos move to one-file examples (EX).

export type { RendererLayer } from './scene.ts'

export interface Renderer {
  /** Takes one sim step's render changes and events. */
  apply(result: StepResult): void
  /** One display frame. `time` is in milliseconds. */
  draw(time: number): void
  /** Forgets the old sim's entities (a new round starts with a fresh sim and a resync). */
  reset(): void
  /** Re-fits the canvas to its container. */
  fitToHost(): void
  /** The character's hitbox top-left in pixels, for the page's data attributes. */
  playerPixel(): { x: number; y: number } | null
  /** Adds a demo's layer (see RendererLayer); the returned function removes it again. */
  addLayer(layer: RendererLayer): () => void
  /** True if `view` is drawn under the light map, so the room's lights fall on it. */
  isLitByRoom(view: Container): boolean
  destroy(): void
}

export async function createRenderer(host: HTMLElement, room: Room): Promise<Renderer> {
  const width = room.width * room.tileSize
  const height = room.height * room.tileSize
  TextureSource.defaultOptions.scaleMode = 'nearest'
  const app = new Application()
  await app.init({
    width,
    height,
    background: endesga(15),
    antialias: false,
    preference: 'webgl',
    resolution: 1,
    // The demo's loop draws each frame itself (src/loop.ts), so Pixi's own ticker stays off.
    autoStart: false,
  })
  app.ticker.stop()
  app.canvas.classList.add('stage')
  host.appendChild(app.canvas)
  const scene = createScene(app.renderer, room)
  app.stage.addChild(scene.world, scene.overlay)

  const fitToHost = () => {
    const scale = Math.min(host.clientWidth / width, host.clientHeight / height)
    // Whole-pixel scaling keeps pixel art crisp; below 2× a phone gets the fractional fit instead of a tiny game.
    const shown = scale >= 2 ? Math.floor(scale) : Math.max(scale, 0.25)
    app.canvas.style.width = `${Math.round(width * shown)}px`
    app.canvas.style.height = `${Math.round(height * shown)}px`
  }
  fitToHost()

  return {
    apply: (result) => scene.apply(result),
    draw(time) {
      scene.draw(time)
      app.render()
    },
    reset: () => scene.reset(),
    fitToHost,
    playerPixel: () => scene.playerPixel(),
    addLayer: (layer) => scene.addLayer(layer),
    isLitByRoom: (view) => scene.isLitByRoom(view),
    destroy() {
      scene.destroy()
      app.destroy(true, { children: true, texture: true })
    },
  }
}
