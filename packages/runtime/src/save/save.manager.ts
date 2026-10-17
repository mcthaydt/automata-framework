// The `Save` service: a game's save slots over `Hosting.saves` (M5 spec §4.3, §5 "Load a slot", §6).
//
// Each slot is one Ruken key holding a canonical envelope, so a host conflict on a slot never splits it from its
// header, and the slot list is derived from `Hosting.saves.keys` with no index key (M5-D2). AF refuses only what
// it can know (a write over a newer build's save); every other refusal is the host's, relayed as a `HostError`.
// Nothing here falls back to device storage (AGENTS.md, "Honor host authority").
import { type HostError, Hosting } from '@mcthaydt/automata-host'
import { canonicalJson } from '@mcthaydt/automata-sim/hash'
import { Clock, Effect, Subscribable, SubscriptionRef } from 'effect'
import { PresentationBus } from '../presentation/presentation-bus.manager.js'
import {
  encodeEnvelope,
  metaOf,
  readSave,
  type SaveDef,
  type SaveEnvelope,
  type SlotMeta,
  type SlotState,
  slotKey,
  slotOf,
  slotState,
} from './save.schema.js'
import { SaveFromNewerBuild, SaveRefused, SaveUnreadable } from './save-error.js'

/** A slot loaded for play. */
export interface Loaded<S> {
  readonly slot: number
  readonly data: S
  /** Undefined for an empty slot. */
  readonly meta: SlotMeta | undefined
  /** The sim snapshot, only when it was taken with this build's content (M5-D5). */
  readonly snapshot?: Uint8Array
}

export interface SaveWriteOptions {
  readonly label?: string
  readonly snapshot?: Uint8Array
}

export interface Save<S> {
  /** Every slot's state, in slot order. */
  readonly slots: Subscribable.Subscribable<readonly SlotState[]>
  load(slot: number): Effect.Effect<Loaded<S>, SaveUnreadable | SaveFromNewerBuild | HostError>
  write(slot: number, data: S, options?: SaveWriteOptions): Effect.Effect<void, SaveRefused | HostError>
  remove(slot: number): Effect.Effect<void, HostError>
}

export interface SaveServiceOptions {
  /** The build's sim content hash (`GameDefinition.content.hash`), stamped on each write and compared on load. */
  readonly contentHash: string
}

/**
 * What decides whether a write changes anything: the canonical envelope without `savedAt`, so the same state
 * written twice sends one `saves.set` however much time passed (S-b).
 */
function identityOf(envelope: SaveEnvelope): string {
  const { savedAt: _savedAt, ...rest } = envelope
  return canonicalJson(rest)
}

const toBase64 = (bytes: Uint8Array): string => {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

const fromBase64 = (text: string): Uint8Array => Uint8Array.from(atob(text), (char) => char.charCodeAt(0))

/** Opens a game's save slots: reads the slot list from the host, then loads, writes and removes slots. */
export function saveService<S>(
  def: SaveDef<S>,
  options: SaveServiceOptions,
): Effect.Effect<Save<S>, HostError, Hosting | PresentationBus> {
  return Effect.gen(function* () {
    const hosting = yield* Hosting
    const bus = yield* PresentationBus
    const { contentHash } = options
    const count = def.slots?.count ?? 1

    // Boot (spec §5 step 1): the keys, then each slot's header. Nothing is migrated yet.
    const states: SlotState[] = Array.from({ length: count }, (_, slot) => ({ kind: 'empty', slot }))
    // Per slot, the identity of what the host holds as far as this service knows: what it read or last wrote.
    const lastKnown: (string | undefined)[] = Array.from({ length: count }, () => undefined)
    const remember = (slot: number, raw: string | null) => {
      const read = raw === null ? undefined : readSave(def, raw)
      lastKnown[slot] = read?.ok === true ? identityOf(read.envelope) : undefined
    }
    for (const key of yield* hosting.saves.keys) {
      const slot = slotOf(def, key)
      if (slot === undefined) continue
      const raw = yield* hosting.saves.get(key)
      states[slot] = slotState(def, slot, raw, contentHash)
      remember(slot, raw)
    }
    const ref = yield* SubscriptionRef.make<readonly SlotState[]>(states)

    const stateOf = (slot: number) => Effect.map(SubscriptionRef.get(ref), (all) => all[slot])
    const setState = (slot: number, state: SlotState) =>
      SubscriptionRef.update(ref, (all) => all.map((current, index) => (index === slot ? state : current)))
    const checked = (slot: number) =>
      Number.isInteger(slot) && slot >= 0 && slot < count
        ? Effect.void
        : Effect.dieMessage(`Save '${def.key}': slot ${slot} is not one of its ${count} slots`)

    const load = (slot: number): Effect.Effect<Loaded<S>, SaveUnreadable | SaveFromNewerBuild | HostError> =>
      Effect.gen(function* () {
        yield* checked(slot)
        // Read the host's value, not the one seen at boot: another device may have written since.
        const raw = yield* hosting.saves.get(slotKey(def, slot))
        const state = slotState(def, slot, raw, contentHash)
        if (raw === null) {
          yield* setState(slot, state)
          remember(slot, raw)
          bus.publish('save.loaded', { key: def.key, slot })
          return { slot, data: def.empty(), meta: undefined }
        }
        const read = readSave(def, raw)
        if (!read.ok) {
          // Kept as it is: neither failure writes anything.
          if (read.reason === 'newer') {
            yield* setState(slot, state)
            return yield* new SaveFromNewerBuild({ key: def.key, slot, version: read.version })
          }
          yield* setState(slot, { kind: 'unreadable', slot, reason: read.detail })
          return yield* new SaveUnreadable({ key: def.key, slot, reason: read.detail })
        }
        yield* setState(slot, state)
        remember(slot, raw)
        bus.publish('save.loaded', { key: def.key, slot })
        const { envelope } = read
        const loaded = { slot, data: read.data, meta: metaOf(envelope) }
        // A snapshot taken with other content is dropped (M5-D5): only the data loads.
        return envelope.snapshot !== undefined && envelope.contentHash === contentHash
          ? { ...loaded, snapshot: fromBase64(envelope.snapshot) }
          : loaded
      })

    const write = (slot: number, data: S, writeOptions: SaveWriteOptions = {}) =>
      Effect.gen(function* () {
        yield* checked(slot)
        const key = slotKey(def, slot)
        if ((yield* stateOf(slot))?.kind === 'newer')
          return yield* new SaveRefused({ key: def.key, slot, reason: 'newer' })

        const envelope: SaveEnvelope = {
          format: 1,
          version: def.version,
          contentHash,
          savedAt: yield* Clock.currentTimeMillis,
          data: data as Record<string, unknown>,
          ...(writeOptions.label === undefined ? {} : { label: writeOptions.label }),
          ...(writeOptions.snapshot === undefined ? {} : { snapshot: toBase64(writeOptions.snapshot) }),
        }
        const identity = identityOf(envelope)
        if (identity === lastKnown[slot]) return

        const raw = encodeEnvelope(envelope)
        yield* hosting.saves
          .set(key, raw)
          .pipe(
            Effect.tapError((error) =>
              Effect.sync(() => bus.publish('save.failed', { key: def.key, slot, code: error.code })),
            ),
          )
        lastKnown[slot] = identity
        yield* setState(slot, slotState(def, slot, raw, contentHash))
        bus.publish('save.written', { key: def.key, slot })
      })

    const remove = (slot: number) =>
      Effect.gen(function* () {
        yield* checked(slot)
        yield* hosting.saves.remove(slotKey(def, slot))
        lastKnown[slot] = undefined
        yield* setState(slot, { kind: 'empty', slot })
      })

    return {
      slots: Subscribable.make({ get: SubscriptionRef.get(ref), changes: ref.changes }),
      load,
      write,
      remove,
    }
  })
}
