/**
 * Boot failures and the state each one draws.
 *
 * The runtime owns `BootError`; ui draws it. `BootFailure` is the structural view the runtime's
 * union must satisfy, so ui never imports the runtime. The match is exhaustive: a new tag fails
 * typecheck here until it has a state.
 */

import type { ErrorCode as HostErrorCode } from '../../host/error-code.schema.ts'

/** The host contract's error code. */
export type ErrorCode = HostErrorCode

/**
 * The structural view of the runtime's boot error that the UI draws: one of six tagged cases, so ui never
 * imports the runtime.
 */
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
  | { readonly _tag: 'BootDefect' }
  /** A 3D model file that could not be read: `file` is its url, `reason` why. */
  | { readonly _tag: 'ModelInvalid'; readonly file: string; readonly reason: string }

/**
 * `Hosting['kind']`, written out because ui never imports host. A `web` session draws as `standalone`: it has no host to go back to.
 */
export type HostKind = 'ruken' | 'standalone' | 'tauri'

/**
 * What a boot failure draws: `start`, `connect`, `progress`, `damaged`, `download`, `download-stalled`,
 * `unsupported` or `model-invalid`.
 */
export type BootFailureState =
  | 'start'
  | 'connect'
  | 'progress'
  | 'damaged'
  | 'download'
  | 'download-stalled'
  | 'unsupported'
  | 'model-invalid'

/** Try again, Continue without loading, Back to {host}. */
export type BootFailureAction = 'retry' | 'continue' | 'exit'

/**
 * What `bootFailureView` decides for a failure: the state to draw and the ways forward, in order. No actions
 * means the panel is final.
 */
export interface BootFailureViewModel {
  readonly state: BootFailureState
  readonly actions: BootFailureAction[]
}

/**
 * The words for every boot failure state and action, by name. `BOOT_FAILURE_COPY_EN` holds the English
 * defaults.
 */
export type BootFailureCopy = Readonly<Record<BootFailureState | BootFailureAction | 'quit', string>>

/**
 * English defaults, quiet and human, with no blame; a game replaces them with its own copy. `{host}` is filled
 * with the host's name (`Hosting.hostName`: 'Ruken', 'itch.io' …) by `withHostName`.
 */
export const BOOT_FAILURE_COPY_EN: BootFailureCopy = {
  start: "Couldn't start the game.",
  connect: "Couldn't connect to Ruken.",
  progress: "Couldn't load your progress.",
  damaged: 'This copy of the game is damaged. Download it again.',
  download: "Couldn't download the game.",
  'download-stalled': 'Still waiting for the game to download.',
  unsupported: "This device can't run the game.",
  'model-invalid': 'A 3D model in this copy of the game is damaged: {file}.',
  retry: 'Try again',
  continue: 'Continue without loading',
  exit: 'Back to {host}',
  // The exit action's words on the desktop, where leaving the game quits the app.
  quit: 'Quit',
}

/**
 * Fills the `{file}` slot of a copy string with the base name of the file a failure names (`nightstand.glb`, not
 * the url it was fetched from). Copy without the slot is returned as is.
 */
export function withFileName(text: string, file: string): string {
  const path = file.split(/[?#]/)[0] ?? file
  const name =
    path
      .split('/')
      .filter((part) => part !== '')
      .pop() ?? path
  return text.replaceAll('{file}', name)
}

/** Fills the `{host}` slot of a copy string with the host's name. Copy without the slot is returned as is. */
export function withHostName(text: string, hostName: string): string {
  return text.replaceAll('{host}', hostName)
}

/**
 * Which state a failure draws and which ways forward it offers. `canExit` is whether the host granted `exit`;
 * without it "Back to …" is never offered.
 *
 * - Host start (`init`): `Ruken.init` threw. Try again when Ruken says a retry can succeed;
 *   otherwise it is a build or config fault (a bad `gameId` or `wants`) the player cannot fix, so
 *   the panel is final. A failed in-frame handshake is not an error: the SDK falls back to standalone.
 * - Storage (`saves.*`): Try again when Ruken says a retry can succeed. Otherwise a standalone page
 *   may go on without the saved progress; inside Ruken the way forward is Back to Ruken, because
 *   playing on without the player's saves would silently fork their progress.
 * - Renderer: nothing on this device can fix it. Inside Ruken the player goes back; a standalone
 *   page has nowhere to go, so its panel is final.
 * - Model: a 3D model file did not parse. Try again fetches it again in a fresh boot; when the file
 *   stays damaged, the host's way out is offered beside it.
 * - Everything else: Try again, which re-runs the boot program in a fresh scope (never a page reload
 *   inside a Ruken frame).
 */
export function bootFailureView(
  failure: BootFailure,
  hostKind: HostKind,
  canExit: boolean,
): BootFailureViewModel {
  const view = viewFor(failure, hostKind)
  // "Back to …" needs the host's `exit` grant. Without it the panel offers what is left, or
  // is final; it never turns exit into Continue, which would fork a hosted player's progress.
  return canExit ? view : { state: view.state, actions: view.actions.filter((action) => action !== 'exit') }
}

function viewFor(failure: BootFailure, hostKind: HostKind): BootFailureViewModel {
  switch (failure._tag) {
    case 'HostError':
      if (failure.operation === 'init') return { state: 'start', actions: failure.retryable ? ['retry'] : [] }
      if (!failure.operation.startsWith('saves.')) return { state: 'connect', actions: ['retry'] }
      if (failure.retryable) return { state: 'progress', actions: ['retry'] }
      return { state: 'progress', actions: [hostKind === 'ruken' ? 'exit' : 'continue'] }
    case 'ContentHashMismatch':
      return { state: 'damaged', actions: ['retry'] }
    case 'AssetLoadFailed':
      return { state: 'download', actions: ['retry'] }
    case 'LoadStalled':
      return { state: 'download-stalled', actions: ['retry'] }
    case 'RendererUnavailable':
      return { state: 'unsupported', actions: hostKind === 'standalone' ? [] : ['exit'] }
    case 'ModelInvalid':
      return { state: 'model-invalid', actions: ['retry', 'exit'] }
    case 'BootDefect':
      // A bug, not a typed failure; Try again re-runs boot.
      return { state: 'start', actions: ['retry'] }
    default:
      return unhandled(failure)
  }
}

/** Fails typecheck when a `BootFailure` tag has no case above. */
function unhandled(failure: never): never {
  throw new Error(`no UI state for boot failure ${JSON.stringify(failure)}`)
}
