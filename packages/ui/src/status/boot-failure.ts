/**
 * Boot failures and the state each one draws (M1 shared contracts §3; M1.6 spec §3.6).
 *
 * The runtime owns `BootError`; ui draws it. `BootFailure` is the structural view the runtime's
 * union must satisfy, so ui never imports the runtime. The match is exhaustive: a new tag fails
 * typecheck here until it has a state.
 */

import type { RukenError } from '@ruken/sdk'

/** Ruken's error code. The SDK exports the class, not the alias. */
export type ErrorCode = RukenError['code']

export type BootFailure =
  | {
      readonly _tag: 'HostError'
      readonly code: ErrorCode
      readonly retryable: boolean
      readonly operation: string
    }
  | { readonly _tag: 'ContentHashMismatch'; readonly expected: string; readonly actual: string }
  | { readonly _tag: 'AssetLoadFailed'; readonly url: string; readonly status: number }
  | {
      readonly _tag: 'LoadStalled'
      readonly url: string
      readonly bytesSoFar: number
      readonly stalledMs: number
    }
  | { readonly _tag: 'RendererUnavailable'; readonly tried: readonly ('webgl2' | 'webgpu')[] }

/** `Hosting['kind']` (shared contracts §1.1), written out until packages/host lands. */
export type HostKind = 'ruken' | 'standalone'

export type BootFailureState =
  | 'start'
  | 'connect'
  | 'progress'
  | 'damaged'
  | 'download'
  | 'download-stalled'
  | 'unsupported'

/** Try again, Continue without loading, Back to Ruken. */
export type BootFailureAction = 'retry' | 'continue' | 'exit'

export interface BootFailureViewModel {
  readonly state: BootFailureState
  readonly actions: BootFailureAction[]
}

export type BootFailureCopy = Readonly<Record<BootFailureState | BootFailureAction, string>>

/** English defaults in Ruken's tone (quiet, human, no blame); replaced by Paraglide keys in M5. */
export const BOOT_FAILURE_COPY_EN: BootFailureCopy = {
  start: "Couldn't start the game.",
  connect: "Couldn't connect to Ruken.",
  progress: "Couldn't load your progress.",
  damaged: 'This copy of the game is damaged.',
  download: "Couldn't download the game.",
  'download-stalled': 'Still waiting for the game to download.',
  unsupported: "This device can't run the game.",
  retry: 'Try again',
  continue: 'Continue without loading',
  exit: 'Back to Ruken',
}

/**
 * Which state a failure draws and which ways forward it offers.
 *
 * - Host start (`init`): `Ruken.init` threw. Try again when Ruken says a retry can succeed;
 *   otherwise it is a build or config fault (a bad `gameId` or `wants`) the player cannot fix, so
 *   the panel is final. A failed in-frame handshake is not an error: the SDK falls back to standalone.
 * - Storage (`saves.*`): Try again when Ruken says a retry can succeed. Otherwise a standalone page
 *   may go on without the saved progress; inside Ruken the way forward is Back to Ruken, because
 *   playing on without the player's saves would silently fork their progress.
 * - Renderer: nothing on this device can fix it. Inside Ruken the player goes back; a standalone
 *   page has nowhere to go, so its panel is final.
 * - Everything else: Try again, which re-runs the boot program in a fresh scope (never a page reload
 *   inside a Ruken frame).
 */
export function bootFailureView(failure: BootFailure, hostKind: HostKind): BootFailureViewModel {
  switch (failure._tag) {
    case 'HostError':
      if (failure.operation === 'init') return { state: 'start', actions: failure.retryable ? ['retry'] : [] }
      if (!failure.operation.startsWith('saves.')) return { state: 'connect', actions: ['retry'] }
      if (failure.retryable) return { state: 'progress', actions: ['retry'] }
      return { state: 'progress', actions: [hostKind === 'standalone' ? 'continue' : 'exit'] }
    case 'ContentHashMismatch':
      return { state: 'damaged', actions: ['retry'] }
    case 'AssetLoadFailed':
      return { state: 'download', actions: ['retry'] }
    case 'LoadStalled':
      return { state: 'download-stalled', actions: ['retry'] }
    case 'RendererUnavailable':
      return { state: 'unsupported', actions: hostKind === 'ruken' ? ['exit'] : [] }
    default:
      return unhandled(failure)
  }
}

/** Fails typecheck when a `BootFailure` tag has no case above. */
function unhandled(failure: never): never {
  throw new Error(`no UI state for boot failure ${JSON.stringify(failure)}`)
}
