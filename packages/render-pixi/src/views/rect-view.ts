import { Graphics } from 'pixi.js'
import type { EntityViewFactory } from '../delta/render-delta-consumer.js'
import { anchorXY, placeView, type ViewAnchor } from './view-pose.js'

export interface RectViewOptions {
  /** Width in world pixels. */
  readonly w: number
  /** Height in world pixels. */
  readonly h: number
  /** Fill colour, e.g. 0xf9c22b. */
  readonly color: number
  /** Default 0.5 (centred on the entity's position). */
  readonly anchor?: ViewAnchor | undefined
}

/**
 * A filled rectangle that follows its component's `x`, `y` and `angle`, interpolated between ticks:
 * `entityViews: { [Body.id]: rect({ w: 8, h: 8, color: 0xf9c22b }) }`.
 */
export function rect(options: RectViewOptions): EntityViewFactory {
  const anchor = anchorXY(options.anchor)
  return (_row, componentId) => {
    const graphics = new Graphics()
      .rect(-anchor.x * options.w, -anchor.y * options.h, options.w, options.h)
      .fill(options.color)
    return {
      container: graphics,
      update(curr, prev, alpha = 1) {
        placeView(graphics, curr, prev, alpha, componentId)
      },
      destroy() {
        graphics.destroy()
      },
    }
  }
}
