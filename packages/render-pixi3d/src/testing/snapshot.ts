// The canvas's pixels for the renderer's parity tests (#241's probe, M3.4d's Mac Firefox failure): one helper, so a
// test cannot fall back to the `RenderTexture` read that comes back all black in macOS Firefox.
import { RenderTexture } from 'pixi.js'
import type { Pixi3dRenderer } from '../renderer/create-pixi3d-renderer.js'

/**
 * The canvas's pixels as the last `draw` left them, top row first. Call it in the same task as that `draw`: the
 * canvas keeps no drawing buffer past the task (`preserveDrawingBuffer` is off). WebGL2 reads the default framebuffer
 * with `gl.readPixels`, not a render into a `RenderTexture` and `extract`: under `@pixi/3d` 0.1.0-beta.2 in macOS
 * Firefox that texture reads back all black while the canvas holds the scene (the #241 probe).
 */
export function snapshot(renderer: Pixi3dRenderer): Uint8ClampedArray | Uint8Array {
  const { app } = renderer.stage
  if (app.renderer.name !== 'webgl') {
    // WebGPU has no readPixels; its canvas texture is read back through Pixi's extract (the GPU runner).
    const texture = RenderTexture.create({
      width: app.screen.width,
      height: app.screen.height,
      resolution: 1,
    })
    app.renderer.render({ container: app.stage, target: texture, clear: true })
    const { pixels } = app.renderer.extract.pixels(texture)
    texture.destroy(true)
    return pixels
  }
  const gl = (app.renderer as unknown as { gl: WebGL2RenderingContext }).gl
  const width = gl.drawingBufferWidth
  const height = gl.drawingBufferHeight
  const bottomUp = new Uint8Array(width * height * 4)
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, bottomUp)
  const row = width * 4
  const pixels = new Uint8Array(bottomUp.length)
  for (let y = 0; y < height; y++)
    pixels.set(bottomUp.subarray((height - 1 - y) * row, (height - y) * row), y * row)
  return pixels
}
