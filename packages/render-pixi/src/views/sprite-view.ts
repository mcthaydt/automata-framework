import { Assets, Rectangle, Sprite, Texture } from 'pixi.js'
import type { EntityViewFactory } from '../delta/render-delta-consumer.js'
import { anchorXY, placeView, poseComponent, type ViewAnchor } from './view-pose.js'

/**
 * The texture is a sheet of equal frames, read left to right, top to bottom. The pose component's numeric
 * `frame` field picks one (floored, wrapped by the frame count); with no `frame` field the first is shown.
 * Frames switch on ticks; they are not interpolated.
 */
export interface SpriteFrames {
  readonly width: number
  readonly height: number
  /** Default: every whole frame that fits in the texture. */
  readonly count?: number | undefined
}

export interface SpriteViewOptions {
  /** Default 0.5 (centred on the entity's position). */
  readonly anchor?: ViewAnchor | undefined
  readonly frames?: SpriteFrames | undefined
}

function sliceFrames(sheet: Texture, frames: SpriteFrames | undefined): readonly Texture[] {
  if (frames === undefined) return [sheet]
  const columns = Math.floor(sheet.frame.width / frames.width)
  const rows = Math.floor(sheet.frame.height / frames.height)
  const count = Math.min(frames.count ?? columns * rows, columns * rows)
  const out: Texture[] = []
  for (let i = 0; i < count; i++) {
    const frame = new Rectangle(
      sheet.frame.x + (i % columns) * frames.width,
      sheet.frame.y + Math.floor(i / columns) * frames.height,
      frames.width,
      frames.height,
    )
    out.push(new Texture({ source: sheet.source, frame }))
  }
  return out.length > 0 ? out : [sheet]
}

function frameIndex(frame: unknown, count: number): number {
  if (typeof frame !== 'number' || !Number.isFinite(frame)) return 0
  return ((Math.floor(frame) % count) + count) % count
}

/**
 * A sprite that follows its component's `x`, `y` and `angle`, interpolated between ticks. `source` is a
 * texture or a url: a url the runtime already loaded (it is in `Assets.cache`) shows at once; otherwise the
 * sprite is empty until `Assets.load` resolves. A url that fails to load is reported with `reportError`
 * and the sprite stays empty. The frame textures are sliced once per factory and shared by its sprites.
 */
export function sprite(source: Texture | string, options: SpriteViewOptions = {}): EntityViewFactory {
  const anchor = anchorXY(options.anchor)
  let frames: readonly Texture[] | undefined
  let loading: Promise<readonly Texture[]> | undefined

  if (typeof source !== 'string') {
    frames = sliceFrames(source, options.frames)
  } else if (Assets.cache.has(source)) {
    frames = sliceFrames(Assets.cache.get(source) as Texture, options.frames)
  }

  function load(url: string): Promise<readonly Texture[]> {
    if (loading === undefined) {
      loading = Assets.load<Texture>(url).then((sheet) => {
        frames = sliceFrames(sheet, options.frames)
        return frames
      })
      // One report per factory, however many sprites wait on the same url.
      loading.catch((error: unknown) => globalThis.reportError?.(error))
    }
    return loading
  }

  return (_row, componentId) => {
    const shown = new Sprite(frames?.[0] ?? Texture.EMPTY)
    shown.anchor.set(anchor.x, anchor.y)
    let frameField: unknown

    const showFrame = (): void => {
      if (frames === undefined || shown.destroyed) return
      shown.texture = frames[frameIndex(frameField, frames.length)] ?? Texture.EMPTY
    }

    if (frames === undefined && typeof source === 'string') {
      load(source).then(showFrame, () => {})
    }

    return {
      container: shown,
      update(curr, prev, alpha = 1) {
        placeView(shown, curr, prev, alpha, componentId)
        frameField = poseComponent(curr, componentId)?.frame
        showFrame()
      },
      destroy() {
        shown.destroy()
      },
    }
  }
}
