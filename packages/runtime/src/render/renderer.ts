import type { StepResult } from '@mcthaydt/automata-sim'
import type { GeometryOwner } from '@mcthaydt/automata-ui'
import { Context, type Effect, type Scope } from 'effect'
import type { RendererUnavailable } from '../boot/boot-error.js'
import type { Assets } from '../loading/assets.manager.js'
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
 * Builds the game's renderer on a render target in a scope, failing `RendererUnavailable` when it cannot
 * start.
 */
export type RendererFactory = (
  target: RenderTarget,
) => Effect.Effect<GameRenderer, RendererUnavailable, Scope.Scope>

/** The game's renderer as a runtime service. */
export const Renderer: Context.Tag<GameRenderer, GameRenderer> = Context.GenericTag<GameRenderer>(
  '@mcthaydt/automata-runtime/Renderer',
)
