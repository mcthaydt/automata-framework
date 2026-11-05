import type { StepResult } from '@mcthaydt/automata-sim'
import { Effect, type Scope } from 'effect'
import { RendererUnavailable } from '../../shared/runtime/boot-error.js'
import type { FrameInfo } from '../../shared/runtime/loop/frames.js'
import type { GameRenderer, RendererFactory, RenderTarget } from '../../shared/runtime/render/renderer.js'

/** One call `nullRenderer` recorded. */
export type NullRendererEntry =
  | { readonly type: 'apply'; readonly tick: number }
  | { readonly type: 'draw'; readonly alpha: number }
  | { readonly type: 'reset' }
  | { readonly type: 'destroy' }

/** Options for `nullRenderer`: `fail` makes it fail `RendererUnavailable`. */
export interface NullRendererOptions {
  readonly fail?: boolean
}

/** A renderer that draws nothing and records each call in `log`, for runtime tests without a GPU. */
export function nullRenderer(
  log: NullRendererEntry[] = [],
  options: NullRendererOptions = {},
): RendererFactory {
  return (_target: RenderTarget): Effect.Effect<GameRenderer, RendererUnavailable, Scope.Scope> => {
    if (options.fail) {
      return Effect.fail(new RendererUnavailable({ tried: ['webgl2'] }))
    }

    return Effect.gen(function* () {
      yield* Effect.addFinalizer(() =>
        Effect.sync(() => {
          log.push({ type: 'destroy' })
        }),
      )

      const renderer: GameRenderer = {
        apply(result: StepResult): void {
          log.push({ type: 'apply', tick: result.tick })
        },
        draw(frame: FrameInfo): void {
          log.push({ type: 'draw', alpha: frame.alpha })
        },
        reset(): void {
          log.push({ type: 'reset' })
        },
      }

      return renderer
    })
  }
}
