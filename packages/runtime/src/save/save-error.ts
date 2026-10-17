import { Data } from 'effect'
import type { TaggedErrorClass } from '../boot/boot-error.js'

export interface SaveUnreadableFields {
  /** The save's key prefix (`SaveDef.key`). */
  readonly key: string
  readonly slot: number
  readonly reason: string
}
const SaveUnreadableBase: TaggedErrorClass<'SaveUnreadable', SaveUnreadableFields> =
  Data.TaggedError('SaveUnreadable')
/**
 * A slot's save cannot be read: a damaged envelope, a missing or throwing migration step, or data its schema refuses
 * (M5 spec §6). The slot is kept untouched; only an explicit write replaces it.
 */
export class SaveUnreadable extends SaveUnreadableBase {}

export interface SaveFromNewerBuildFields {
  readonly key: string
  readonly slot: number
  /** The version the newer build stored. */
  readonly version: number
}
const SaveFromNewerBuildBase: TaggedErrorClass<'SaveFromNewerBuild', SaveFromNewerBuildFields> =
  Data.TaggedError('SaveFromNewerBuild')
/** A slot was saved by a newer build. It is read-only here: nothing migrates, writes or autosaves over it. */
export class SaveFromNewerBuild extends SaveFromNewerBuildBase {}

export interface SaveRefusedFields {
  readonly key: string
  readonly slot: number
  /** Why AF refused before asking the host. Everything else is the host's to refuse, relayed as a `HostError`. */
  readonly reason: 'newer'
}
const SaveRefusedBase: TaggedErrorClass<'SaveRefused', SaveRefusedFields> = Data.TaggedError('SaveRefused')
/** A write AF refuses on its own: over a save from a newer build (M5 spec §4.3). */
export class SaveRefused extends SaveRefusedBase {}
