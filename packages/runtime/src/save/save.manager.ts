// The `Save` service: a game's save slots over `Hosting.saves` (M5 spec §4.3, §5 "Load a slot", §6).
//
// Each slot is one Ruken key holding a canonical envelope, so a host conflict on a slot never splits it from its
// header, and the slot list is derived from `Hosting.saves.keys` with no index key (M5-D2). AF refuses only what
// it can know (a write over a newer build's save); every other refusal is the host's, relayed as a `HostError`.
// Nothing here falls back to device storage (AGENTS.md, "Honor host authority").
import { type HostError, Hosting } from '@mcthaydt/automata-host'
import { canonicalJson } from '@mcthaydt/automata-sim/hash'
import { Clock, Duration, Effect, Runtime, type Scope, Stream, Subscribable, SubscriptionRef } from 'effect'
import { PresentationBus } from '../presentation/presentation-bus.manager.js'
import {
  type AutosaveTrigger,
  autosaveOf,
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

/** Options for `Save.write`: the slot's label on the list, and a sim snapshot to keep with the data. */
export interface SaveWriteOptions {
  readonly label?: string
  readonly snapshot?: Uint8Array
}

/**
 * A game's save (M5 spec §4.3): its slots' states, load, write and remove, and the progress `touch` keeps for
 * the autosave triggers to write.
 */
export interface Save<S> {
  /** Every slot's state, in slot order. */
  readonly slots: Subscribable.Subscribable<readonly SlotState[]>
  /** The slot being played: the last one `load` returned. Undefined before the first load. */
  readonly loaded: Subscribable.Subscribable<number | undefined>
  /**
   * Reads a slot and makes it the one being played. Progress `touch`ed before is dropped: it came from the game this
   * load replaces, and must not be written over what was just read.
   */
  load(slot: number): Effect.Effect<Loaded<S>, SaveUnreadable | SaveFromNewerBuild | HostError>
  write(slot: number, data: S, options?: SaveWriteOptions): Effect.Effect<void, SaveRefused | HostError>
  remove(slot: number): Effect.Effect<void, HostError>
  /**
   * Says the loaded slot's progress changed and what it is now. A plain function, safe to call every tick: it only
   * keeps `data`, and the next autosave trigger writes it. With no slot loaded it keeps nothing.
   */
  touch(data: () => S): void
  /**
   * Writes the progress `touch` has kept for every slot that still has some, now, whatever the autosave policy
   * (an exit must not lose progress because `on` left out a trigger). It still never writes a slot whose state
   * is not `ready` or `empty` (a newer build's, a damaged one, one loaded with other content), nor the slot
   * another device changed while it was played, until the player answers: that progress stays kept (Keep
   * playing releases it; Load newer and any other load drop it). It never fails, because it runs inside the host's exit; a refused write is the `save.failed`
   * fact, and the progress stays kept for the next flush.
   */
  readonly flushPending: Effect.Effect<void>
  /**
   * What a trigger calls: `flushPending` if the save's policy lists `trigger`, otherwise nothing. `saveService`
   * already wires every trigger to its source; this is for a game that raises one itself.
   */
  autosave(trigger: AutosaveTrigger): Effect.Effect<void>
  /**
   * True while the loaded slot holds something another device wrote after it was loaded (M5-D6). Nothing is
   * reloaded, and no trigger writes that slot over the other device's until the player answers. Lowered by
   * `keepPlaying`, `loadNewer` or any load.
   */
  readonly changedElsewhere: Subscribable.Subscribable<boolean>
  /** Loads the loaded slot again, so the game plays what the other device wrote. Dies when nothing is loaded. */
  loadNewer(): Effect.Effect<Loaded<S>, SaveUnreadable | SaveFromNewerBuild | HostError>
  /** The player chose to carry on: lowers `changedElsewhere`. The next trigger writes the progress kept over the other device's, as any write would. */
  keepPlaying(): void
}

/** What the save service stamps on every write and checks on every load. */
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

/**
 * Whether the host keeps saves this session: when it grants `saves`, or when Ruken fell back to standalone, whose
 * SDK keeps them on the device without a grant (shared contracts §1.2), as the paused screen reads it.
 */
export const savesKept = (hosting: Hosting): boolean =>
  hosting.kind === 'standalone' || hosting.granted.has('saves')

/** Opens a game's save slots: reads the slot list from the host, then loads, writes and removes slots. */
export function saveService<S>(
  def: SaveDef<S>,
  options: SaveServiceOptions,
): Effect.Effect<Save<S>, HostError, Hosting | PresentationBus | Scope.Scope> {
  return Effect.gen(function* () {
    const policy = autosaveOf(def)
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
    // A target that does not grant saves (a web page with storage blocked) is asked for nothing: every slot lists and
    // loads empty and a write sends nothing. Each call would fail DENIED and stop a game that can run, which says on
    // its paused screen that progress won't be kept (DIST spec §8 flow 5). Never the device's storage instead.
    const granted = savesKept(hosting)
    const listed = granted ? yield* hosting.saves.keys : []
    for (const key of listed) {
      const slot = slotOf(def, key)
      if (slot === undefined) continue
      const raw = yield* hosting.saves.get(key)
      states[slot] = slotState(def, slot, raw, contentHash)
      remember(slot, raw)
    }
    const ref = yield* SubscriptionRef.make<readonly SlotState[]>(states)

    // The slot being played, and per slot the latest progress `touch` has not yet seen written.
    const loadedRef = yield* SubscriptionRef.make<number | undefined>(undefined)
    let loadedSlot: number | undefined
    const pending = new Map<number, () => S>()
    const changedElsewhereRef = yield* SubscriptionRef.make(false)
    // The slot another device changed while it was played, until the player answers (Load newer or Keep playing). Its
    // progress stays kept and no trigger writes it, or a pause (which opens the choice) would overwrite the other
    // device's progress before the player has chosen.
    let heldSlot: number | undefined
    const setLoaded = (slot: number) =>
      Effect.suspend(() => {
        loadedSlot = slot
        // A load is the slot's newest word: progress touched before it came from a game that is being replaced
        // (Load newer, or Continue), and must not be written over what was just read.
        pending.delete(slot)
        // The same holds for progress held back for a slot another device changed: it belongs to the replaced game.
        if (heldSlot !== undefined) pending.delete(heldSlot)
        heldSlot = undefined
        // A fresh load is the newest there is: whatever another device wrote is what was just read.
        return SubscriptionRef.set(changedElsewhereRef, false).pipe(
          Effect.zipRight(SubscriptionRef.set(loadedRef, slot)),
        )
      })

    const stateOf = (slot: number) => Effect.map(SubscriptionRef.get(ref), (all) => all[slot])
    // Writes, removals and autosaves of one slot take turns: one is in flight, the rest wait behind it.
    const gates = new Map<number, Effect.Semaphore>()
    const gateOf = (slot: number): Effect.Semaphore => {
      let gate = gates.get(slot)
      if (gate === undefined) {
        gate = Effect.unsafeMakeSemaphore(1)
        gates.set(slot, gate)
      }
      return gate
    }
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
        const raw = granted ? yield* hosting.saves.get(slotKey(def, slot)) : null
        const state = slotState(def, slot, raw, contentHash)
        if (raw === null) {
          yield* setState(slot, state)
          remember(slot, raw)
          bus.publish('save.loaded', { key: def.key, slot })
          yield* setLoaded(slot)
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
        yield* setLoaded(slot)
        const { envelope } = read
        const loaded = { slot, data: read.data, meta: metaOf(envelope) }
        // A snapshot taken with other content is dropped (M5-D5): only the data loads.
        return envelope.snapshot !== undefined && envelope.contentHash === contentHash
          ? { ...loaded, snapshot: fromBase64(envelope.snapshot) }
          : loaded
      })

    const locked = <A, E>(slot: number, effect: Effect.Effect<A, E>): Effect.Effect<A, E> =>
      checked(slot).pipe(Effect.zipRight(gateOf(slot).withPermits(1)(effect)))

    const writeNow = (slot: number, data: S, writeOptions: SaveWriteOptions = {}) =>
      Effect.gen(function* () {
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
        if (!granted) return

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

    const write = (slot: number, data: S, writeOptions?: SaveWriteOptions) =>
      locked(slot, writeNow(slot, data, writeOptions))

    const remove = (slot: number) =>
      locked(
        slot,
        Effect.gen(function* () {
          yield* hosting.saves.remove(slotKey(def, slot))
          lastKnown[slot] = undefined
          yield* setState(slot, { kind: 'empty', slot })
        }),
      )

    const touch = (data: () => S): void => {
      if (loadedSlot !== undefined) pending.set(loadedSlot, data)
    }

    // Takes the slot's turn, then writes whatever `touch` has by then: triggers that piled up behind a slow write
    // find nothing left once the first of them has taken it, so they collapse into one more write.
    const flushSlot = (slot: number): Effect.Effect<void> =>
      gateOf(slot).withPermits(1)(
        Effect.gen(function* () {
          const progress = pending.get(slot)
          if (progress === undefined || slot === heldSlot) return
          const state = yield* stateOf(slot)
          // Never over a save this build cannot or should not overwrite on its own; the progress stays kept.
          if (state === undefined || (state.kind !== 'ready' && state.kind !== 'empty')) return
          const data = progress()
          // Autosave knows only the data, so the label the slot list shows rides along from the stored header.
          const label = state.kind === 'ready' ? state.meta.label : undefined
          yield* writeNow(slot, data, label === undefined ? {} : { label })
          // A touch that landed during the write replaced the entry and stays kept.
          if (pending.get(slot) === progress) pending.delete(slot)
        }).pipe(
          // A refused write is already the `save.failed` fact. A `touch` that throws is the game's mistake: logged,
          // and never allowed to fail an exit.
          Effect.catchAll(() => Effect.void),
          Effect.catchAllDefect((defect) =>
            Effect.logWarning(`Save '${def.key}': the progress of slot ${slot} could not be read`, defect),
          ),
        ),
      )

    const flushPending = Effect.suspend(() =>
      Effect.forEach([...pending.keys()], flushSlot, { discard: true }),
    )

    const autosave = (trigger: AutosaveTrigger): Effect.Effect<void> =>
      policy.on.has(trigger) ? flushPending : Effect.void

    const loadNewer = () =>
      Effect.suspend(() =>
        loadedSlot === undefined
          ? Effect.dieMessage(`Save '${def.key}': loadNewer needs a loaded slot`)
          : load(loadedSlot),
      )
    const keepPlaying = (): void => {
      heldSlot = undefined
      Effect.runSync(SubscriptionRef.set(changedElsewhereRef, false))
    }

    // Another device wrote a slot (spec §5, M5-D6): the list and what this service believes the host holds follow
    // the host's value, at the slot's turn so a write in flight lands first. The slot being played is not reloaded:
    // the flag goes up and the game decides. The echo of this game's own write is not news.
    const changedOnHost = (slot: number) =>
      gateOf(slot).withPermits(1)(
        Effect.gen(function* () {
          const raw = yield* hosting.saves.get(slotKey(def, slot))
          const read = raw === null ? undefined : readSave(def, raw)
          const unchanged =
            raw === null
              ? (yield* stateOf(slot))?.kind === 'empty'
              : read?.ok === true && identityOf(read.envelope) === lastKnown[slot]
          if (unchanged) return
          yield* setState(slot, slotState(def, slot, raw, contentHash))
          remember(slot, raw)
          if (slot !== loadedSlot) return
          heldSlot = slot
          yield* SubscriptionRef.set(changedElsewhereRef, true)
          bus.publish('save.changedElsewhere', { key: def.key, slot })
        }),
      )
    yield* hosting.saves.changed.pipe(
      Stream.runForEach(({ key }) => {
        const slot = slotOf(def, key)
        return slot === undefined ? Effect.void : Effect.ignore(changedOnHost(slot))
      }),
      Effect.forkScoped,
    )

    // The triggers, each wired to its source for as long as the scope is open (spec §4.4). A trigger that comes
    // from outside Effect (the bus) starts its flush on this service's runtime, so it sees the same Clock.
    const runFork = Runtime.runFork(yield* Effect.runtime<never>())
    if (policy.on.has('screen-exit')) {
      yield* Effect.acquireRelease(
        Effect.sync(() =>
          bus.subscribe('screen.entered', ({ from }) => {
            // The first screen leaves nothing behind.
            if (from !== undefined) runFork(autosave('screen-exit'))
          }),
        ),
        (unsubscribe) => Effect.sync(unsubscribe),
      )
    }
    if (policy.on.has('round-end')) {
      yield* hosting.round.ended.pipe(
        Stream.runForEach(() => autosave('round-end')),
        Effect.forkScoped,
      )
    }
    if (policy.on.has('background')) {
      // S-d: write, then hand the host everything it holds, because a page in the background may be frozen or closed
      // before anything else runs. A flush the host refuses is simply over.
      yield* hosting.lifecycle.changes.pipe(
        Stream.map((change) => change.state),
        Stream.changes,
        Stream.filter((state) => state === 'background'),
        Stream.runForEach(() =>
          autosave('background').pipe(Effect.zipRight(Effect.ignore(hosting.saves.flush))),
        ),
        Effect.forkScoped,
      )
    }
    if (policy.intervalSeconds !== undefined) {
      yield* Effect.sleep(Duration.seconds(policy.intervalSeconds)).pipe(
        Effect.zipRight(autosave('interval')),
        Effect.forever,
        Effect.forkScoped,
      )
    }
    // Leaving through the host, or closing this scope, must not lose progress (spec §5, "Restart and dispose"). The
    // finalizer is added last, so it runs first, while the triggers above can still be told apart from a late one.
    yield* hosting.onExiting(flushPending)
    yield* Effect.addFinalizer(() => flushPending)

    return {
      slots: Subscribable.make({ get: SubscriptionRef.get(ref), changes: ref.changes }),
      loaded: Subscribable.make({ get: SubscriptionRef.get(loadedRef), changes: loadedRef.changes }),
      load,
      write,
      remove,
      touch,
      flushPending,
      autosave,
      changedElsewhere: Subscribable.make({
        get: SubscriptionRef.get(changedElsewhereRef),
        changes: changedElsewhereRef.changes,
      }),
      loadNewer,
      keepPlaying,
    }
  })
}
