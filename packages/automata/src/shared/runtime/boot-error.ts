import { Data } from 'effect'
import type { YieldableError } from 'effect/Cause'
import type { HostError } from '../host/errors.ts'
import type { BootFailure } from '../ui/status/boot-failure.ts'

export type TaggedErrorClass<Tag extends string, Fields> = new (
  fields: Fields,
) => YieldableError & { readonly _tag: Tag } & Readonly<Fields>

export interface LoadStalledFields {
  readonly url: string
  readonly bytesSoFar: number
  readonly stalledMs: number
}
const LoadStalledBase: TaggedErrorClass<'LoadStalled', LoadStalledFields> = Data.TaggedError('LoadStalled')
/**
 * A resource download had no progress reported for STALL_MS (30 s).
 * Triggers the "Taking a while" screen with a Try again button.
 */
export class LoadStalled extends LoadStalledBase {}

export interface AssetLoadFailedFields {
  readonly url: string
  readonly status: number
}
const AssetLoadFailedBase: TaggedErrorClass<'AssetLoadFailed', AssetLoadFailedFields> =
  Data.TaggedError('AssetLoadFailed')
/**
 * An asset download failed with a non-OK HTTP status or network error (status 0).
 */
export class AssetLoadFailed extends AssetLoadFailedBase {}

export interface RendererUnavailableFields {
  readonly tried: readonly ('webgl2' | 'webgpu')[]
}
const RendererUnavailableBase: TaggedErrorClass<'RendererUnavailable', RendererUnavailableFields> =
  Data.TaggedError('RendererUnavailable')
/**
 * Neither WebGL2 nor WebGPU could be initialized.
 * In Ruken this presents the "unsupported" screen with an exit button.
 */
export class RendererUnavailable extends RendererUnavailableBase {}

export interface ModelInvalidFields {
  /** The model's url, as the game names it. */
  readonly file: string
  /** Why it was refused: `skinned`, `malformed: <what>`, `unsupported type` or `not loaded`. */
  readonly reason: string
}
const ModelInvalidBase: TaggedErrorClass<'ModelInvalid', ModelInvalidFields> =
  Data.TaggedError('ModelInvalid')
/**
 * A 3D model file could not be read (M3 spec §6): malformed, of an unknown type, not loaded, or a glTF with a skin,
 * which is not supported yet (M3R-D1). Boot shows the panel naming the file, with Try again.
 */
export class ModelInvalid extends ModelInvalidBase {}

export interface ContentHashMismatchFields {
  readonly expected: string
  readonly actual: string
}
const ContentHashMismatchBase: TaggedErrorClass<'ContentHashMismatch', ContentHashMismatchFields> =
  Data.TaggedError('ContentHashMismatch')
/**
 * Content hash does not match expected hash.
 */
export class ContentHashMismatch extends ContentHashMismatchBase {}

export interface BootDefectFields {
  readonly cause: unknown
}
const BootDefectBase: TaggedErrorClass<'BootDefect', BootDefectFields> = Data.TaggedError('BootDefect')
/**
 * An unexpected defect during boot.
 */
export class BootDefect extends BootDefectBase {}

/** Every way boot can fail; each draws on the runtime's boot failure panel (shared contracts §4). */
export type BootError =
  | HostError
  | ContentHashMismatch
  | AssetLoadFailed
  | LoadStalled
  | RendererUnavailable
  | ModelInvalid
  | BootDefect

// Shared contracts §4: BootError must be structurally assignable to BootFailure.
type Drawable<T extends BootFailure> = T
export type BootErrorIsDrawable = Drawable<BootError>
