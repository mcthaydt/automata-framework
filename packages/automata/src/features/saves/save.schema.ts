// What a game saves, and how a stored save is read. From FloorFifty `common/progress.ts` at
// `ac72660`, with the stricter save policy:
// - a save from a newer build is never migrated or written over ("opening an older build must not erase it");
// - a field this build does not know rides through, so a write by an older build of the same version keeps it;
// - an unreadable save is kept as it is and shown as damaged, never read as empty (FloorFifty reads it as empty).
// Settings differ on purpose (`settings/migrate-settings.ts`): losing a preference is acceptable, losing progress
// is not.
import { canonicalJson } from '@mcthaydt/automata-sim/hash'
import type { z } from 'zod'

/** One migration step of a save: version `n` data in, version `n + 1` data out (`SaveDef.migrations`). */
export type SaveMigration = (record: Record<string, unknown>) => Record<string, unknown>

/** What can make the loaded slot write itself. */
export type AutosaveTrigger = 'screen-exit' | 'round-end' | 'background' | 'interval'

/**
 * When the loaded slot writes itself: on each listed trigger, with `intervalSeconds` for the `interval`
 * timer.
 */
export interface AutosavePolicy {
  readonly on: readonly AutosaveTrigger[]
  /** Seconds between timer writes, default 60. Read only when `interval` is in `on`. */
  readonly intervalSeconds?: number
}

/** A game's save: one record, or a fixed number of slots, each one Ruken key. */
export interface SaveDef<S> {
  /** The key prefix. Ruken's key rule is the SDK's, which checks it on write. */
  readonly key: string
  /** This build's version of the data, an integer from 1. */
  readonly version: number
  readonly schema: z.ZodType<S>
  /** What an empty slot loads as. */
  readonly empty: () => S
  /** `migrations[n]` turns version `n` data into version `n + 1`. */
  readonly migrations: Readonly<Record<number, SaveMigration>>
  /** Absent: one record, slot 0, stored at `key`. */
  readonly slots?: { readonly count: number }
  /** Absent: save on `screen-exit`, `round-end` and `background`, with no timer (M5-D10). `{ on: [] }` turns it off. */
  readonly autosave?: AutosavePolicy
}

/** What is stored: a self-describing envelope, one Ruken key per slot. */
export interface SaveEnvelope {
  readonly format: 1
  readonly version: number
  /** The sim content hash at save time. */
  readonly contentHash: string
  /** Effect `Clock` epoch ms, for the slot list; outside the sim. */
  readonly savedAt: number
  readonly label?: string
  readonly data: Record<string, unknown>
  /** An optional sim snapshot, base64 (M5-D5). */
  readonly snapshot?: string
}

/** A slot's header, read without migrating it. */
export interface SlotMeta {
  readonly version: number
  readonly contentHash: string
  readonly savedAt: number
  readonly label?: string
  /** Whether the save carries a sim snapshot. */
  readonly snapshot: boolean
}

/** What a slot holds, as the slot list shows it. */
export type SlotState =
  | { readonly kind: 'empty'; readonly slot: number }
  | { readonly kind: 'ready'; readonly slot: number; readonly meta: SlotMeta }
  | { readonly kind: 'unreadable'; readonly slot: number; readonly reason: string }
  | { readonly kind: 'newer'; readonly slot: number; readonly version: number }
  /** A snapshot taken with other content: only its data loads (M5-D5). */
  | { readonly kind: 'other-content'; readonly slot: number; readonly meta: SlotMeta }

/** A stored save read for this build. */
export type ReadSave<S> =
  | { readonly ok: true; readonly data: S; readonly envelope: SaveEnvelope }
  | { readonly ok: false; readonly reason: 'unreadable'; readonly detail: string }
  | { readonly ok: false; readonly reason: 'newer'; readonly version: number }

/** Declares a save. It checks nothing the SDK checks; it only gives the definition its type. */
export function defineSave<S>(def: SaveDef<S>): SaveDef<S> {
  return def
}

const DEFAULT_AUTOSAVE_ON: readonly AutosaveTrigger[] = ['screen-exit', 'round-end', 'background']
const DEFAULT_AUTOSAVE_INTERVAL_SECONDS = 60

/** A save's autosave policy with its defaults filled in. */
export interface ResolvedAutosave {
  readonly on: ReadonlySet<AutosaveTrigger>
  /** Undefined when `interval` is not one of the triggers: there is no timer. */
  readonly intervalSeconds: number | undefined
}

/**
 * The policy a save runs under: the defaults when it declares none, each trigger once, and the timer's period only
 * when the timer is asked for. A period a timer cannot keep (zero, negative or not finite) throws: the game's own
 * mistake, found at boot instead of as a busy loop.
 */
export function autosaveOf(def: SaveDef<unknown>): ResolvedAutosave {
  const on = new Set(def.autosave?.on ?? DEFAULT_AUTOSAVE_ON)
  if (!on.has('interval')) return { on, intervalSeconds: undefined }
  const intervalSeconds = def.autosave?.intervalSeconds ?? DEFAULT_AUTOSAVE_INTERVAL_SECONDS
  if (!Number.isFinite(intervalSeconds) || intervalSeconds <= 0)
    throw new RangeError(
      `Save '${def.key}': autosave intervalSeconds must be a positive number, got ${intervalSeconds}`,
    )
  return { on, intervalSeconds }
}

/** The Ruken key slot `slot` is stored at. */
export function slotKey(def: SaveDef<unknown>, slot: number): string {
  return def.slots === undefined ? def.key : `${def.key}.slot.${slot}`
}

/** The slot a Ruken key holds, or undefined when it is none of this save's slots. */
export function slotOf(def: SaveDef<unknown>, key: string): number | undefined {
  if (def.slots === undefined) return key === def.key ? 0 : undefined
  const prefix = `${def.key}.slot.`
  if (!key.startsWith(prefix)) return undefined
  const digits = key.slice(prefix.length)
  // Only the form `slotKey` writes: no sign, no leading zero, below `count`.
  if (!/^(0|[1-9][0-9]*)$/.test(digits)) return undefined
  const slot = Number(digits)
  return slot < def.slots.count ? slot : undefined
}

/** The stored form: canonical JSON, so the same state always writes the same bytes. */
export function encodeEnvelope(envelope: SaveEnvelope): string {
  return canonicalJson(envelope)
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Parses a stored value's envelope, or says why it cannot. Checks the shape only, not the data. */
function parseEnvelope(raw: string): { readonly envelope: SaveEnvelope } | { readonly unreadable: string } {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { unreadable: 'not JSON' }
  }
  if (!isRecord(parsed)) return { unreadable: 'not a save envelope' }
  const { format, version, contentHash, savedAt, label, data, snapshot } = parsed
  if (format !== 1) return { unreadable: `unknown save format ${String(format)}` }
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1)
    return { unreadable: 'no save version' }
  if (typeof contentHash !== 'string' || typeof savedAt !== 'number' || !isRecord(data))
    return { unreadable: 'a damaged save header' }
  if (label !== undefined && typeof label !== 'string') return { unreadable: 'a damaged save label' }
  if (snapshot !== undefined && typeof snapshot !== 'string') return { unreadable: 'a damaged snapshot' }
  return { envelope: parsed as unknown as SaveEnvelope }
}

/** The header a slot list shows. */
export function metaOf(envelope: SaveEnvelope): SlotMeta {
  const meta = {
    version: envelope.version,
    contentHash: envelope.contentHash,
    savedAt: envelope.savedAt,
    snapshot: envelope.snapshot !== undefined,
  }
  return envelope.label === undefined ? meta : { ...meta, label: envelope.label }
}

/** Classifies a stored value from its header, without migrating it. */
export function slotState(
  def: SaveDef<unknown>,
  slot: number,
  raw: string | null,
  contentHash: string,
): SlotState {
  if (raw === null) return { kind: 'empty', slot }
  const parsed = parseEnvelope(raw)
  if ('unreadable' in parsed) return { kind: 'unreadable', slot, reason: parsed.unreadable }
  const { envelope } = parsed
  if (envelope.version > def.version) return { kind: 'newer', slot, version: envelope.version }
  const meta = metaOf(envelope)
  // Only a snapshot depends on the content; data alone loads under any content.
  if (envelope.snapshot !== undefined && envelope.contentHash !== contentHash)
    return { kind: 'other-content', slot, meta }
  return { kind: 'ready', slot, meta }
}

/**
 * Reads a stored save for this build: its migrations step by step (`n` → `n + 1`), then the schema. A missing or
 * throwing step, or a failed parse, makes it unreadable; a later build's save is never migrated.
 */
export function readSave<S>(def: SaveDef<S>, raw: string): ReadSave<S> {
  const parsed = parseEnvelope(raw)
  if ('unreadable' in parsed) return { ok: false, reason: 'unreadable', detail: parsed.unreadable }
  const { envelope } = parsed
  if (envelope.version > def.version) return { ok: false, reason: 'newer', version: envelope.version }

  let record = envelope.data
  for (let version = envelope.version; version < def.version; version++) {
    const step = def.migrations[version]
    if (typeof step !== 'function')
      return { ok: false, reason: 'unreadable', detail: `no migration from version ${version}` }
    try {
      record = step(record)
    } catch (cause) {
      return {
        ok: false,
        reason: 'unreadable',
        detail: `migration from version ${version} failed: ${String(cause)}`,
      }
    }
  }

  const result = def.schema.safeParse(record)
  if (!result.success)
    return { ok: false, reason: 'unreadable', detail: 'the save does not match its schema' }
  // Passthrough, whatever the schema strips: a field a later build of this version added survives this build's write.
  const data = isRecord(result.data) ? ({ ...record, ...result.data } as S) : result.data
  return { ok: true, data, envelope }
}
