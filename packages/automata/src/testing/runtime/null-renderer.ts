import type { StepResult } from '@mcthaydt/automata-sim'
import { ok, refused } from '../../shared/lib/result.js'
import { RendererUnavailable } from '../../shared/runtime/boot-error.js'
import type { FrameInfo } from '../../shared/runtime/loop/frames.js'
import type { OwnedRenderer, RendererFactory } from '../../shared/runtime/render/renderer.js'

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

/** The renderer `nullRenderer` builds: it draws nothing and records each call in `log`. */
export function nullGameRenderer(log: NullRendererEntry[] = []): OwnedRenderer {
  return {
    apply(result: StepResult): void {
      log.push({ type: 'apply', tick: result.tick })
    },
    draw(frame: FrameInfo): void {
      log.push({ type: 'draw', alpha: frame.alpha })
    },
    reset(): void {
      log.push({ type: 'reset' })
    },
    dispose(): void {
      log.push({ type: 'destroy' })
    },
  }
}

/** A renderer that draws nothing and records each call in `log`, for runtime tests without a GPU. */
export function nullRenderer(
  log: NullRendererEntry[] = [],
  options: NullRendererOptions = {},
): RendererFactory {
  return async () =>
    options.fail ? refused(new RendererUnavailable({ tried: ['webgl2'] })) : ok(nullGameRenderer(log))
}
