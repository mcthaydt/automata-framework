import type { TaggedErrorClass } from '@mcthaydt/automata-node'
import { Context, Data, type Effect } from 'effect'

// The `csp` step's browser run (DX spec §3.6), as an Effect service so the step's logic is tested without a
// browser. CspProbeLive (csp-probe-live.ts) serves the build with Ruken's headers and opens it in Chromium.

export interface CspProbeInput {
  /** The game folder: its `ship.config.ts` gives the manifest the headers are compiled from. */
  readonly gameDir: string
  readonly distDir: string
  readonly timeoutMs: number
}

export interface CspProbeResult {
  /** `<html data-state="ready">` was seen before the timeout. */
  readonly ready: boolean
  /** The last `data-state` seen (`loading`, `ready`, `failed`), or undefined if the page never set it. */
  readonly state: string | undefined
  /** One entry per `securitypolicyviolation` event: the directive and what it blocked. */
  readonly violations: readonly string[]
}

const CheckToolErrorBase: TaggedErrorClass<
  'CheckToolError',
  { readonly kind: 'missing' | 'failed'; readonly tool: string; readonly detail: string }
> = Data.TaggedError('CheckToolError')

/** A check step could not run: its tool is not installed (`missing`) or did not work (`failed`). */
export class CheckToolError extends CheckToolErrorBase {
  override get message(): string {
    return this.kind === 'missing' ? `${this.tool} not found; ${this.detail}` : `${this.tool}: ${this.detail}`
  }
}

export interface CspProbeService {
  run(input: CspProbeInput): Effect.Effect<CspProbeResult, CheckToolError>
}

/** The service's tag (the `Files` pattern in `@mcthaydt/automata-node`). */
export interface CspProbe {
  readonly _CspProbe: unique symbol
}
export const CspProbe: Context.Tag<CspProbe, CspProbeService> = Context.GenericTag<CspProbe, CspProbeService>(
  '@mcthaydt/automata-cli/CspProbe',
)
