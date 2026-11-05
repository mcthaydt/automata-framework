// What AF itself says about a slot: it cannot be read, or a newer build wrote it. Each is an answer the screens show
// (`{ ok: false, reason }`), not a throw; `_tag` names it, as the host's refusals are named by `code`.

/** The fields of `SaveUnreadable`. */
export interface SaveUnreadableFields {
  /** The save's key prefix (`SaveDef.key`). */
  readonly key: string
  readonly slot: number
  readonly reason: string
}
/**
 * A slot's save cannot be read: a damaged envelope, a missing or throwing migration step, or data its schema refuses.
 * The slot is kept untouched; only an explicit write replaces it.
 */
export class SaveUnreadable extends Error {
  readonly _tag = 'SaveUnreadable' as const
  readonly key: string
  readonly slot: number
  readonly reason: string

  constructor(fields: SaveUnreadableFields) {
    super(`Save '${fields.key}': slot ${fields.slot} cannot be read: ${fields.reason}`)
    this.name = 'SaveUnreadable'
    this.key = fields.key
    this.slot = fields.slot
    this.reason = fields.reason
  }
}

/** The fields of `SaveFromNewerBuild`. */
export interface SaveFromNewerBuildFields {
  readonly key: string
  readonly slot: number
  /** The version the newer build stored. */
  readonly version: number
}
/** A slot was saved by a newer build. It is read-only here: nothing migrates, writes or autosaves over it. */
export class SaveFromNewerBuild extends Error {
  readonly _tag = 'SaveFromNewerBuild' as const
  readonly key: string
  readonly slot: number
  readonly version: number

  constructor(fields: SaveFromNewerBuildFields) {
    super(`Save '${fields.key}': slot ${fields.slot} was saved by a newer build (version ${fields.version})`)
    this.name = 'SaveFromNewerBuild'
    this.key = fields.key
    this.slot = fields.slot
    this.version = fields.version
  }
}

/** The fields of `SaveRefused`. */
export interface SaveRefusedFields {
  readonly key: string
  readonly slot: number
  /** Why AF refused before asking the host. Everything else is the host's to refuse, relayed as its refusal. */
  readonly reason: 'newer'
}
/** A write AF refuses on its own: over a save from a newer build. */
export class SaveRefused extends Error {
  readonly _tag = 'SaveRefused' as const
  readonly key: string
  readonly slot: number
  readonly reason: 'newer'

  constructor(fields: SaveRefusedFields) {
    super(`Save '${fields.key}': slot ${fields.slot} is from a newer build, so it is not written over`)
    this.name = 'SaveRefused'
    this.key = fields.key
    this.slot = fields.slot
    this.reason = fields.reason
  }
}
