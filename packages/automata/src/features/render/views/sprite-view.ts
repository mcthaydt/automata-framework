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

/** A `sprite` view's anchor and either its sprite-sheet frames or one frame of a packed atlas. */
export interface SpriteViewOptions {
  /** Default 0.5 (centred on the entity's position). */
  readonly anchor?: ViewAnchor | undefined
  readonly frames?: SpriteFrames | undefined
  /**
   * A frame of a packed atlas: `source` is the url of an atlas page's Spritesheet JSON, which
   * `automata-content assets` writes, and `frame` names one of its frames. Not with `frames`.
   */
  readonly frame?: string | undefined
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

/** The textures `loaded` (a texture, or a Spritesheet when `frame` is given) shows; throws on a missing frame. */
function texturesOf(loaded: unknown, options: SpriteViewOptions): readonly Texture[] {
  if (options.frame === undefined) return sliceFrames(loaded as Texture, options.frames)
  const textures = (loaded as { textures?: Record<string, Texture> } | undefined)?.textures
  const texture = textures?.[options.frame]
  if (texture === undefined) throw new Error(`sprite: the atlas has no frame '${options.frame}'`)
  return [texture]
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
 * With `frame`, the url is an atlas page's Spritesheet and the sprite shows that frame; a name the atlas lacks
 * is reported the same way.
 */
export function sprite(source: Texture | string, options: SpriteViewOptions = {}): EntityViewFactory {
  if (options.frame !== undefined && options.frames !== undefined) {
    throw new Error(
      'sprite: `frame` (an atlas frame) and `frames` (a sheet of equal frames) cannot be combined',
    )
  }
  const anchor = anchorXY(options.anchor)
  let frames: readonly Texture[] | undefined
  let loading: Promise<readonly Texture[]> | undefined

  if (typeof source !== 'string') {
    frames = sliceFrames(source, options.frames)
  } else if (Assets.cache.has(source)) {
    try {
      frames = texturesOf(Assets.cache.get(source), options)
    } catch (error) {
      // Reported once; the sprites stay empty, as for a url that fails to load.
      globalThis.reportError?.(error)
      frames = [Texture.EMPTY]
    }
  }

  function load(url: string): Promise<readonly Texture[]> {
    if (loading === undefined) {
      loading = Assets.load<unknown>(url).then((loaded) => {
        frames = texturesOf(loaded, options)
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
