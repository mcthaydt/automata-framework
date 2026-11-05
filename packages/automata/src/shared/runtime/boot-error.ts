// Every way boot can fail, as plain `Error` classes with a `_tag` the boot failure panel switches on.
import type { HostRefusal } from '../host/errors.ts'
import type { BootFailure } from '../ui/status/boot-failure.ts'

export interface LoadStalledFields {
  readonly url: string
  readonly bytesSoFar: number
  readonly stalledMs: number
}
/**
 * A resource download had no progress reported for STALL_MS (30 s).
 * Triggers the "Taking a while" screen with a Try again button.
 */
export class LoadStalled extends Error {
  readonly _tag = 'LoadStalled' as const
  readonly url: string
  readonly bytesSoFar: number
  readonly stalledMs: number

  constructor(fields: LoadStalledFields) {
    super(`'${fields.url}' made no progress for ${fields.stalledMs} ms (${fields.bytesSoFar} bytes so far)`)
    this.name = 'LoadStalled'
    this.url = fields.url
    this.bytesSoFar = fields.bytesSoFar
    this.stalledMs = fields.stalledMs
  }
}

export interface AssetLoadFailedFields {
  readonly url: string
  readonly status: number
}
/**
 * An asset download failed with a non-OK HTTP status or network error (status 0).
 */
export class AssetLoadFailed extends Error {
  readonly _tag = 'AssetLoadFailed' as const
  readonly url: string
  readonly status: number

  constructor(fields: AssetLoadFailedFields) {
    super(`'${fields.url}' failed to download (status ${fields.status})`)
    this.name = 'AssetLoadFailed'
    this.url = fields.url
    this.status = fields.status
  }
}

export interface RendererUnavailableFields {
  readonly tried: readonly ('webgl2' | 'webgpu')[]
}
/**
 * Neither WebGL2 nor WebGPU could be initialized.
 * In Ruken this presents the "unsupported" screen with an exit button.
 */
export class RendererUnavailable extends Error {
  readonly _tag = 'RendererUnavailable' as const
  readonly tried: readonly ('webgl2' | 'webgpu')[]

  constructor(fields: RendererUnavailableFields) {
    super(`No renderer started (tried ${fields.tried.join(', ')})`)
    this.name = 'RendererUnavailable'
    this.tried = fields.tried
  }
}

export interface ModelInvalidFields {
  /** The model's url, as the game names it. */
  readonly file: string
  /** Why it was refused: `skinned`, `malformed: <what>`, `unsupported type` or `not loaded`. */
  readonly reason: string
}
/**
 * A 3D model file could not be read: malformed, of an unknown type, not loaded, or a glTF with a skin,
 * which is not supported yet. Boot shows the panel naming the file, with Try again.
 */
export class ModelInvalid extends Error {
  readonly _tag = 'ModelInvalid' as const
  readonly file: string
  readonly reason: string

  constructor(fields: ModelInvalidFields) {
    super(`'${fields.file}' could not be read: ${fields.reason}`)
    this.name = 'ModelInvalid'
    this.file = fields.file
    this.reason = fields.reason
  }
}

export interface ContentHashMismatchFields {
  readonly expected: string
  readonly actual: string
}
/**
 * Content hash does not match expected hash.
 */
export class ContentHashMismatch extends Error {
  readonly _tag = 'ContentHashMismatch' as const
  readonly expected: string
  readonly actual: string

  constructor(fields: ContentHashMismatchFields) {
    super(`The content's hash is ${fields.actual}, not ${fields.expected}`)
    this.name = 'ContentHashMismatch'
    this.expected = fields.expected
    this.actual = fields.actual
  }
}

/**
 * The host refused a call boot needs (the handshake, `ready`, the settings or the save). It carries the refusal's
 * fields, so the panel can tell a retryable refusal from a final one.
 */
export class HostError extends Error {
  readonly _tag = 'HostError' as const
  readonly code: HostRefusal['code']
  readonly retryable: boolean
  readonly operation: string

  constructor(refusal: HostRefusal) {
    super(`The host refused ${refusal.operation}: ${refusal.code}`, { cause: refusal.cause })
    this.name = 'HostError'
    this.code = refusal.code
    this.retryable = refusal.retryable
    this.operation = refusal.operation
  }
}

export interface BootDefectFields {
  readonly cause: unknown
}
/**
 * An unexpected defect during boot: a bug, not a refusal. `cause` is what was thrown.
 */
export class BootDefect extends Error {
  readonly _tag = 'BootDefect' as const

  constructor(fields: BootDefectFields) {
    super(`Boot failed unexpectedly: ${String(fields.cause)}`, { cause: fields.cause })
    this.name = 'BootDefect'
  }
}

/** Every way boot can fail; each draws on the runtime's boot failure panel. */
export type BootError =
  | HostError
  | ContentHashMismatch
  | AssetLoadFailed
  | LoadStalled
  | RendererUnavailable
  | ModelInvalid
  | BootDefect

// BootError must be structurally assignable to BootFailure.
type Drawable<T extends BootFailure> = T
/** @public Compile-time check only; nothing imports it. */
export type BootErrorIsDrawable = Drawable<BootError>
