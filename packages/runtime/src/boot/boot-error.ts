import { Data } from 'effect'
import type { YieldableError } from 'effect/Cause'

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
  readonly tried: readonly string[]
}
const RendererUnavailableBase: TaggedErrorClass<'RendererUnavailable', RendererUnavailableFields> =
  Data.TaggedError('RendererUnavailable')
/**
 * Neither WebGL2 nor WebGPU could be initialized.
 * In Ruken this presents the "unsupported" screen with an exit button.
 */
export class RendererUnavailable extends RendererUnavailableBase {}
