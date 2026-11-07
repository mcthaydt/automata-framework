// The `Save` service: a game's save slots over `Hosting.saves`.
//
// Each slot is one Ruken key holding a canonical envelope, so a host conflict on a slot never splits it from its
// header, and the slot list is derived from `Hosting.saves.keys` with no index key (M5-D2). AF refuses only what
// it can know (a write over a newer build's save); every other refusal is the host's, relayed as its `HostRefusal`.
// Refusals are answers (`{ ok: false, reason }`), never throws; asking for a slot the save does not have is a bug and
// throws. Nothing here falls back to device storage (AGENTS.md, "Honor host authority").

import { canonicalJson } from '@mcthaydt/automata-sim/hash'
import type { HostRefusal } from '../../shared/host/errors.ts'
import type { Hosting } from '../../shared/host/hosting.ts'
import { type Clock, systemClock } from '../../shared/lib/clock.ts'
import { disposables } from '../../shared/lib/disposables.ts'
import { ok, type Result, refused } from '../../shared/lib/result.ts'
import { type Subscribable, state } from '../../shared/lib/subscribable.ts'
import type { PresentationBus } from '../../shared/runtime/presentation/presentation-bus.manager.js'
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
 * A game's save: its slots' states, load, write and remove, and the progress `touch` keeps for
 * the autosave triggers to write.
 */
export interface Save<S> {
  /** Every slot's state, in slot order. */
  readonly slots: Subscribable<readonly SlotState[]>
  /** The slot being played: the last one `load` returned. Undefined before the first load. */
  readonly loaded: Subscribable<number | undefined>
  /**
   * Reads a slot and makes it the one being played. Progress `touch`ed before is dropped: it came from the game this
   * load replaces, and must not be written over what was just read. A slot the save does not have throws.
   */
  load(slot: number): Promise<Result<Loaded<S>, SaveUnreadable | SaveFromNewerBuild | HostRefusal>>
  write(slot: number, data: S, options?: SaveWriteOptions): Promise<Result<void, SaveRefused | HostRefusal>>
  remove(slot: number): Promise<Result<void, HostRefusal>>
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
   * playing releases it; Load newer and any other load drop it). It never rejects, because it runs inside the host's
   * exit; a refused write is the `save.failed` fact, and the progress stays kept for the next flush.
   */
  flushPending(): Promise<void>
  /**
   * What a trigger calls: `flushPending` if the save's policy lists `trigger`, otherwise nothing. `saveService`
   * already wires every trigger to its source; this is for a game that raises one itself.
   */
  autosave(trigger: AutosaveTrigger): Promise<void>
  /**
   * True while the loaded slot holds something another device wrote after it was loaded (M5-D6). Nothing is
   * reloaded, and no trigger writes that slot over the other device's until the player answers. Lowered by
   * `keepPlaying`, `loadNewer` or any load.
   */
  readonly changedElsewhere: Subscribable<boolean>
  /** Loads the loaded slot again, so the game plays what the other device wrote. Throws when nothing is loaded. */
  loadNewer(): Promise<Result<Loaded<S>, SaveUnreadable | SaveFromNewerBuild | HostRefusal>>
  /** The player chose to carry on: lowers `changedElsewhere`. The next trigger writes the progress kept over the other device's, as any write would. */
  keepPlaying(): void
}

/** What the save service stamps on every write and checks on every load, and what it reads from the runtime. */
export interface SaveServiceOptions {
  /** The build's sim content hash (`GameDefinition.content.hash`), stamped on each write and compared on load. */
  readonly contentHash: string
  readonly hosting: Pick<Hosting, 'kind' | 'granted' | 'saves' | 'round' | 'lifecycle' | 'onExiting'>
  readonly bus: PresentationBus
  /** Runs the `interval` timer. Default the system clock. */
  readonly clock?: Clock
  /** The wall-clock time stamped as `savedAt`, in epoch milliseconds. Default `Date.now`. */
  readonly now?: () => number
  /** Where a `touch` that threw is reported. Default `console.warn`. */
  readonly warn?: (message: string, cause: unknown) => void
}

/** A save that is open: `dispose()` stops its triggers, writes the progress still kept once more, then resolves. */
export type OpenSave<S> = Save<S> & { dispose(): Promise<void> }

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
 * SDK keeps them on the device without a grant, as the paused screen reads it.
 */
export const savesKept = (hosting: Pick<Hosting, 'kind' | 'granted'>): boolean =>
  hosting.kind === 'standalone' || hosting.granted.has('saves')

/**
 * Opens a game's save slots: reads the slot list from the host, then loads, writes and removes slots. A refused read
 * of the list is the answer; nothing is opened then.
 */
export async function saveService<S>(
  def: SaveDef<S>,
  options: SaveServiceOptions,
): Promise<Result<OpenSave<S>, HostRefusal>> {
  const policy = autosaveOf(def)
  const { hosting, bus, contentHash } = options
  const clock = options.clock ?? systemClock
  const now = options.now ?? (() => Date.now())
  const warn = options.warn ?? ((message: string, cause: unknown) => console.warn(message, cause))
  const count = def.slots?.count ?? 1

  // Boot: the keys, then each slot's header. Nothing is migrated yet.
  const states: SlotState[] = Array.from({ length: count }, (_, slot) => ({ kind: 'empty', slot }))
  // Per slot, the identity of what the host holds as far as this service knows: what it read or last wrote.
  const lastKnown: (string | undefined)[] = Array.from({ length: count }, () => undefined)
  const remember = (slot: number, raw: string | null) => {
    const read = raw === null ? undefined : readSave(def, raw)
    lastKnown[slot] = read?.ok === true ? identityOf(read.envelope) : undefined
  }
  // A target that does not grant saves (a web page with storage blocked) is asked for nothing: every slot lists and
  // loads empty and a write sends nothing. Each call would be refused DENIED and stop a game that can run, which says
  // on its paused screen that progress won't be kept. Never the device's storage instead.
  const granted = savesKept(hosting)
  if (granted) {
    const listed = await hosting.saves.keys()
    if (!listed.ok) return listed
    for (const key of listed.value) {
      const slot = slotOf(def, key)
      if (slot === undefined) continue
      const raw = await hosting.saves.get(key)
      if (!raw.ok) return raw
      states[slot] = slotState(def, slot, raw.value, contentHash)
      remember(slot, raw.value)
    }
  }
  const slots = state<readonly SlotState[]>(states)

  // The slot being played, and per slot the latest progress `touch` has not yet seen written.
  const loaded = state<number | undefined>(undefined)
  let loadedSlot: number | undefined
  const pending = new Map<number, () => S>()
  const changedElsewhere = state(false)
  // The slot another device changed while it was played, until the player answers (Load newer or Keep playing). Its
  // progress stays kept and no trigger writes it, or a pause (which opens the choice) would overwrite the other
  // device's progress before the player has chosen.
  let heldSlot: number | undefined
  const setLoaded = (slot: number) => {
    loadedSlot = slot
    // A load is the slot's newest word: progress touched before it came from a game that is being replaced
    // (Load newer, or Continue), and must not be written over what was just read.
    pending.delete(slot)
    // The same holds for progress held back for a slot another device changed: it belongs to the replaced game.
    if (heldSlot !== undefined) pending.delete(heldSlot)
    heldSlot = undefined
    // A fresh load is the newest there is: whatever another device wrote is what was just read.
    changedElsewhere.set(false)
    loaded.set(slot)
  }

  const stateOf = (slot: number) => slots.get()[slot]
  const setState = (slot: number, next: SlotState) =>
    slots.set(slots.get().map((current, index) => (index === slot ? next : current)))
  const checked = (slot: number) => {
    if (!Number.isInteger(slot) || slot < 0 || slot >= count)
      throw new Error(`Save '${def.key}': slot ${slot} is not one of its ${count} slots`)
  }

  // Writes, removals and autosaves of one slot take turns: one is in flight, the rest wait behind it, first come
  // first served. Each slot's queue is the promise of its last task; a task that fails does not stop the next.
  const queues = new Map<number, Promise<unknown>>()
  const inTurn = <A>(slot: number, task: () => Promise<A>): Promise<A> => {
    const turn = (queues.get(slot) ?? Promise.resolve()).then(task)
    queues.set(
      slot,
      turn.catch(() => undefined),
    )
    return turn
  }

  const load = async (
    slot: number,
  ): Promise<Result<Loaded<S>, SaveUnreadable | SaveFromNewerBuild | HostRefusal>> => {
    checked(slot)
    // Read the host's value, not the one seen at boot: another device may have written since.
    let raw: string | null = null
    if (granted) {
      const answer = await hosting.saves.get(slotKey(def, slot))
      if (!answer.ok) return answer
      raw = answer.value
    }
    const slotNow = slotState(def, slot, raw, contentHash)
    if (raw === null) {
      setState(slot, slotNow)
      remember(slot, raw)
      bus.publish('save.loaded', { key: def.key, slot })
      setLoaded(slot)
      return ok({ slot, data: def.empty(), meta: undefined })
    }
    const read = readSave(def, raw)
    if (!read.ok) {
      // Kept as it is: neither failure writes anything.
      if (read.reason === 'newer') {
        setState(slot, slotNow)
        return refused(new SaveFromNewerBuild({ key: def.key, slot, version: read.version }))
      }
      setState(slot, { kind: 'unreadable', slot, reason: read.detail })
      return refused(new SaveUnreadable({ key: def.key, slot, reason: read.detail }))
    }
    setState(slot, slotNow)
    remember(slot, raw)
    bus.publish('save.loaded', { key: def.key, slot })
    setLoaded(slot)
    const { envelope } = read
    const result = { slot, data: read.data, meta: metaOf(envelope) }
    // A snapshot taken with other content is dropped (M5-D5): only the data loads.
    return ok(
      envelope.snapshot !== undefined && envelope.contentHash === contentHash
        ? { ...result, snapshot: fromBase64(envelope.snapshot) }
        : result,
    )
  }

  const writeNow = async (
    slot: number,
    data: S,
    writeOptions: SaveWriteOptions = {},
  ): Promise<Result<void, SaveRefused | HostRefusal>> => {
    if (stateOf(slot)?.kind === 'newer')
      return refused(new SaveRefused({ key: def.key, slot, reason: 'newer' }))

    const envelope: SaveEnvelope = {
      format: 1,
      version: def.version,
      contentHash,
      savedAt: now(),
      data: data as Record<string, unknown>,
      ...(writeOptions.label === undefined ? {} : { label: writeOptions.label }),
      ...(writeOptions.snapshot === undefined ? {} : { snapshot: toBase64(writeOptions.snapshot) }),
    }
    const identity = identityOf(envelope)
    if (identity === lastKnown[slot] || !granted) return ok(undefined)

    const raw = encodeEnvelope(envelope)
    const answer = await hosting.saves.set(slotKey(def, slot), raw)
    if (!answer.ok) {
      bus.publish('save.failed', { key: def.key, slot, code: answer.reason.code })
      return answer
    }
    lastKnown[slot] = identity
    setState(slot, slotState(def, slot, raw, contentHash))
    bus.publish('save.written', { key: def.key, slot })
    return answer
  }

  const write = async (slot: number, data: S, writeOptions?: SaveWriteOptions) => {
    checked(slot)
    return inTurn(slot, () => writeNow(slot, data, writeOptions))
  }

  const remove = async (slot: number): Promise<Result<void, HostRefusal>> => {
    checked(slot)
    return inTurn(slot, async () => {
      const answer = await hosting.saves.remove(slotKey(def, slot))
      if (!answer.ok) return answer
      lastKnown[slot] = undefined
      setState(slot, { kind: 'empty', slot })
      return answer
    })
  }

  const touch = (data: () => S): void => {
    if (loadedSlot !== undefined) pending.set(loadedSlot, data)
  }

  // Takes the slot's turn, then writes whatever `touch` has by then: triggers that piled up behind a slow write
  // find nothing left once the first of them has taken it, so they collapse into one more write.
  const flushSlot = (slot: number): Promise<void> =>
    inTurn(slot, async () => {
      const progress = pending.get(slot)
      if (progress === undefined || slot === heldSlot) return
      const current = stateOf(slot)
      // Never over a save this build cannot or should not overwrite on its own; the progress stays kept.
      if (current === undefined || (current.kind !== 'ready' && current.kind !== 'empty')) return
      let data: S
      try {
        data = progress()
      } catch (cause) {
        // A `touch` that throws is the game's mistake: reported, and never allowed to fail an exit.
        warn(`Save '${def.key}': the progress of slot ${slot} could not be read`, cause)
        return
      }
      // Autosave knows only the data, so the label the slot list shows rides along from the stored header.
      const label = current.kind === 'ready' ? current.meta.label : undefined
      // A refused write is already the `save.failed` fact; the progress stays kept for the next flush.
      const written = await writeNow(slot, data, label === undefined ? {} : { label })
      // A touch that landed during the write replaced the entry and stays kept.
      if (written.ok && pending.get(slot) === progress) pending.delete(slot)
    })

  const flushPending = async (): Promise<void> => {
    for (const slot of [...pending.keys()]) await flushSlot(slot)
  }

  const autosave = (trigger: AutosaveTrigger): Promise<void> =>
    policy.on.has(trigger) ? flushPending() : Promise.resolve()

  const loadNewer = async () => {
    if (loadedSlot === undefined) throw new Error(`Save '${def.key}': loadNewer needs a loaded slot`)
    return load(loadedSlot)
  }
  const keepPlaying = (): void => {
    heldSlot = undefined
    changedElsewhere.set(false)
  }

  // Another device wrote a slot: the list and what this service believes the host holds follow
  // the host's value, at the slot's turn so a write in flight lands first. The slot being played is not reloaded:
  // the flag goes up and the game decides. The echo of this game's own write is not news. A refused re-read
  // changes nothing.
  const changedOnHost = (slot: number) =>
    inTurn(slot, async () => {
      const answer = await hosting.saves.get(slotKey(def, slot))
      if (!answer.ok) return
      const raw = answer.value
      const read = raw === null ? undefined : readSave(def, raw)
      const unchanged =
        raw === null
          ? stateOf(slot)?.kind === 'empty'
          : read?.ok === true && identityOf(read.envelope) === lastKnown[slot]
      if (unchanged) return
      setState(slot, slotState(def, slot, raw, contentHash))
      remember(slot, raw)
      if (slot !== loadedSlot) return
      heldSlot = slot
      changedElsewhere.set(true)
      bus.publish('save.changedElsewhere', { key: def.key, slot })
    })

  // The triggers, each wired to its source until `dispose`.
  const triggers = disposables()
  triggers.add(
    hosting.saves.changed.subscribe(({ key }) => {
      const slot = slotOf(def, key)
      if (slot !== undefined) void changedOnHost(slot)
    }),
  )
  if (policy.on.has('screen-exit')) {
    triggers.add(
      bus.subscribe('screen.entered', ({ from }) => {
        // The first screen leaves nothing behind.
        if (from !== undefined) void autosave('screen-exit')
      }),
    )
  }
  if (policy.on.has('round-end')) {
    triggers.add(hosting.round.ended.subscribe(() => void autosave('round-end')))
  }
  if (policy.on.has('background')) {
    // S-d: write, then hand the host everything it holds, because a page in the background may be frozen or closed
    // before anything else runs. A flush the host refuses is simply over. Only the move into the background counts:
    // the current state heard on subscribing, and a repeat of the same state, are not news.
    let last = 'active'
    triggers.add(
      hosting.lifecycle.subscribe(({ state: next }) => {
        const entered = next === 'background' && last !== 'background'
        last = next
        if (entered) void autosave('background').then(() => hosting.saves.flush())
      }),
    )
  }
  if (policy.intervalSeconds !== undefined) {
    // Each tick sets the next one before it writes, so the period is kept whatever a write costs; writes queue in
    // the slot's turn and collapse, so a slow host never piles them up.
    const ms = policy.intervalSeconds * 1000
    let timer = clock.setTimeout(function tick() {
      timer = clock.setTimeout(tick, ms)
      void autosave('interval')
    }, ms)
    triggers.add(() => clock.clearTimeout(timer))
  }
  // Leaving through the host must not lose progress.
  triggers.add(hosting.onExiting(flushPending))

  let disposing: Promise<void> | undefined
  return ok({
    slots,
    loaded,
    load,
    write,
    remove,
    touch,
    flushPending,
    autosave,
    changedElsewhere,
    loadNewer,
    keepPlaying,
    // Closing must not lose progress either: the triggers stop first, so no late one races the last write.
    dispose: () => {
      disposing ??= (async () => {
        triggers.dispose()
        await flushPending()
      })()
      return disposing
    },
  })
}
