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
