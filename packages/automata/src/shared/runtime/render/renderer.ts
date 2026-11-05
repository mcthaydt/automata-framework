import type { StepResult } from '@mcthaydt/automata-sim'
import { Context, type Effect, type Scope } from 'effect'
import type { GeometryOwner } from '../../ui/geometry/geometry-owner.svelte.ts'
import type { Assets } from '../assets.manager.js'
import type { ModelInvalid, RendererUnavailable } from '../boot-error.js'
import type { FrameInfo } from '../loop/frames.js'
import type { PresentationBus } from '../presentation/presentation-bus.manager.js'

/**
 * Where a renderer draws: the host element, the layout geometry, the loaded assets and the presentation bus.
 */
export interface RenderTarget {
  readonly host: HTMLElement
  readonly geometry: GeometryOwner
  readonly assets: Pick<Assets, 'get'>
  /** The runtime's presentation bus, for render facts such as `render.filter.dropped`. Optional for tests and tools. */
  readonly bus?: PresentationBus | undefined
  /**
   * Shows the "picture stopped" panel with Try again, for a renderer whose graphics context is lost and will not
   * come back by itself: Try again closes the panel and calls `retry`, which rebuilds the renderer from
   * the sim's current state. Returns a function that closes the panel. Optional for tests and tools.
   */
  readonly reportLost?: ((retry: () => void) => () => void) | undefined
}

/**
 * What the runtime asks of a renderer: apply each step's result, draw each frame, and reset for a new sim.
 */
export interface GameRenderer {
  apply(result: StepResult): void
  draw(frame: FrameInfo): void
  reset(): void
}

/**
 * Builds the game's renderer for a target. It fails with `RendererUnavailable` when no backend it accepts starts,
 * and with `ModelInvalid` when a 3D renderer cannot read a model file it was given.
 */
export type RendererFactory = (
  target: RenderTarget,
) => Effect.Effect<GameRenderer, RendererUnavailable | ModelInvalid, Scope.Scope>

/** The game's renderer as a runtime service. */
export const Renderer: Context.Tag<GameRenderer, GameRenderer> = Context.GenericTag<GameRenderer>(
  '@mcthaydt/automata-runtime/Renderer',
)
