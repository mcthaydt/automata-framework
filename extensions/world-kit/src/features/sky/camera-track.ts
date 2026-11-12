// A pass that works in view space follows the camera it is told of: the engine rebuilds `camera.view` every frame, so the
// pass reads it again each tick of Pixi's shared ticker (the frame after the camera moved), and `track` reads it at once.
// The passes that place things in the world (the shafts' lamps, the reflections' ground) are this.

import { PostEffect } from '@pixi/3d'
import { Ticker } from 'pixi.js'

/** The part of a camera a pass reads: its world-to-view matrix (column by column) and whether it is orthographic. */
export interface TrackedCamera {
  readonly mode?: string | undefined
  readonly view: { readonly elements: ArrayLike<number> }
}

const IDENTITY: readonly number[] = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]

export abstract class TrackingEffect extends PostEffect {
  private camera: TrackedCamera | undefined
  private tick: (() => void) | undefined
  private last: Float32Array | undefined
  private lastOrtho = false

  /** The camera the pass is seen from: read now, and again each frame until the pass is destroyed. */
  track(camera: TrackedCamera): void {
    this.camera = camera
    this.refresh()
    if (this.tick === undefined) {
      this.tick = () => this.refresh()
      Ticker.shared.add(this.tick)
    }
  }

  /** Reads the camera again: the pass's uniforms are written only when its view or its mode moved. */
  refresh(): void {
    const camera = this.camera
    if (camera === undefined) return
    const view = Float32Array.from(camera.view.elements)
    const ortho = camera.mode === 'orthographic'
    if (this.last !== undefined && ortho === this.lastOrtho && this.last.every((v, i) => v === view[i]))
      return
    this.last = view
    this.lastOrtho = ortho
    this.viewChanged(view, ortho)
  }

  /** The pass's uniforms for a world-to-view matrix (column by column). */
  protected abstract viewChanged(view: ArrayLike<number>, ortho: boolean): void

  /** The matrix to use until a camera is tracked: the world is the view. */
  protected static readonly NO_VIEW: ArrayLike<number> = IDENTITY

  override destroy(): void {
    if (this.tick !== undefined) Ticker.shared.remove(this.tick)
    this.tick = undefined
    super.destroy()
  }
}
