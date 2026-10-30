import type { StepResult } from '@mcthaydt/automata-sim'
import type { GeometryOwner } from '@mcthaydt/automata-ui'
import { Context, type Effect, type Scope } from 'effect'
import type { ModelInvalid, RendererUnavailable } from '../boot/boot-error.js'
import type { Assets } from '../loading/assets.manager.js'
import type { FrameInfo } from '../loop/frames.js'
import type { PresentationBus } from '../presentation/presentation-bus.manager.js'

export interface RenderTarget {
  readonly host: HTMLElement
  readonly geometry: GeometryOwner
  readonly assets: Pick<Assets, 'get'>
  /** The runtime's presentation bus, for render facts such as `render.filter.dropped`. Optional for tests and tools. */
  readonly bus?: PresentationBus | undefined
}

export interface GameRenderer {
  apply(result: StepResult): void
  draw(frame: FrameInfo): void
  reset(): void
}

/**
 * Builds the game's renderer for a target. It fails with `RendererUnavailable` when no backend it accepts starts,
 * and with `ModelInvalid` when a 3D renderer cannot read a model file it was given (M3 spec §6).
 */
export type RendererFactory = (
  target: RenderTarget,
) => Effect.Effect<GameRenderer, RendererUnavailable | ModelInvalid, Scope.Scope>

export const Renderer: Context.Tag<GameRenderer, GameRenderer> = Context.GenericTag<GameRenderer>(
  '@mcthaydt/automata-runtime/Renderer',
)
