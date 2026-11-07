import { Context, Deferred, Effect, Layer, Option, type Scope, Stream, Subscribable } from 'effect'
import type { z } from 'zod'
import { type AudioChange, AudioChangeSchema } from '../../shared/host/audio.schema.ts'
import type { Capability } from '../../shared/host/capability.schema.ts'
import { type DisplayMetricsPayload, DisplayMetricsPayloadSchema } from '../../shared/host/display.schema.ts'
import { type EntitlementsPayload, EntitlementsPayloadSchema } from '../../shared/host/entitlements.schema.ts'
import type { ErrorCode } from '../../shared/host/error-code.schema.ts'
import { HostError } from '../../shared/host/errors.ts'
import {
  type AnalyticsProps,
  HOST_EXIT_CAP,
  Hosting,
  type HostingOptions,
} from '../../shared/host/hosting.ts'
import { type InputModePayload, InputModePayloadSchema } from '../../shared/host/input-mode.schema.ts'
import type { LeaderboardQuery, LeaderboardSubmitMeta } from '../../shared/host/leaderboards.schema.ts'
import { type LifecyclePayload, LifecyclePayloadSchema } from '../../shared/host/lifecycle.schema.ts'
import type { RoundOutcome } from '../../shared/host/round.schema.ts'
import {
  type SavesChangedPayload,
  SavesChangedPayloadSchema,
  type SavesStatus,
  SavesStatusSchema,
} from '../../shared/host/saves.schema.ts'
import { defaultGrants, type FakeTarget, hostNameOf, kindOf, ungrantedCode } from './target-grants'

/*
 * `FakeHosting` (DIST spec §7): AF's host contract in process, for any target, with no window messages and no
 * platform package. A test picks the target and drives the host through `FakeHostControl`. It runs the host
 * contract suite on every target (`fake-hosting.contract.test.ts`), so it answers as the real adapters do.
 */

/** How the fake host starts. Every field has a default, so `FakeHosting()` is a web page with saves. */
export interface FakeHostingOptions {
  /** The target to stand in for: its `kind`, `hostName`, grants and error codes (DIST spec §4.3). Default `web`. */
  readonly target?: FakeTarget
  /** The capabilities granted, in place of the target's default ones. */
  readonly granted?: readonly Capability[]
  /** When true, `ready` waits for `control.welcome()` (or `control.failReady`); otherwise it is ready at once. */
  readonly deferReady?: boolean
  readonly player?: { readonly id: string; readonly displayName: string }
  readonly locale?: string
  /** The game's title, which the desktop target uses as its `hostName`. Default `Game`. */
  readonly title?: string
  /** Saves already on the host when the session starts. */
  readonly saves?: Readonly<Record<string, string>>
  /** Whether the player consented to analytics. Default true; false drops every `track`. */
  readonly consent?: boolean
  readonly lifecycle?: LifecyclePayload
  readonly input?: InputModePayload
  readonly display?: DisplayMetricsPayload
  readonly audio?: AudioChange
  readonly entitlements?: EntitlementsPayload
  readonly savesStatus?: SavesStatus
}

/** One analytics event the host received. */
export interface TrackedEvent {
  readonly event: string
  readonly props?: AnalyticsProps | undefined
}

/** One leaderboard submission the host received. */
export interface Submission {
  readonly board: string
  readonly score: number
  readonly meta?: LeaderboardSubmitMeta | undefined
}

/** What a test does to, and reads from, the fake host. */
export interface FakeHostControl {
  /** Makes `ready` resolve (with `deferReady`). */
  welcome(): void
  /** Makes `ready` fail with `code` (with `deferReady`). */
  failReady(code: ErrorCode): void
  /** Sends the game a host change. Each payload is checked by its contract schema, so a bad fixture throws here. */
  readonly push: {
    lifecycle(payload: LifecyclePayload): void
    input(payload: InputModePayload): void
    display(payload: DisplayMetricsPayload): void
    audio(payload: AudioChange): void
    entitlements(payload: EntitlementsPayload): void
    savesStatus(status: SavesStatus): void
    /** Another device's write: the host's saves change and `saves.changed` carries it. */
    savesChanged(payload: SavesChangedPayload): void
  }
  /** The host's saves now. */
  readonly saved: ReadonlyMap<string, string>
  /** Makes the next call named `operation` (for example `saves.set`) fail with `code`. */
  failNext(operation: string, code: ErrorCode): void
  /** Holds every call named `operation` unanswered until `release(operation)`, so a test can time it out. */
  hold(operation: string): void
  release(operation: string): void
  readonly tracked: readonly TrackedEvent[]
  readonly exits: readonly ('player' | 'completed')[]
  /** Every fullscreen request, in order. */
  readonly fullscreen: readonly boolean[]
  /** Every round start and end the host received (after the contract's guard), in order. */
  readonly rounds: readonly ({ readonly start: true } | { readonly end: RoundOutcome | undefined })[]
  readonly submits: readonly Submission[]
  /** The host's "Open game menu": the latest handler's answer, or false before `ready` or with none. */
  requestMenu(): boolean
  /** The host closes the game: the exiting handlers in order, then the save flush, all within `HOST_EXIT_CAP`. */
  readonly close: Effect.Effect<void>
}

/** The `FakeHostControl` service tag, provided beside `Hosting` by `FakeHosting`. */
export const FakeHostControl: Context.Tag<FakeHostControl, FakeHostControl> =
  Context.GenericTag<FakeHostControl>('@mcthaydt/automata-testing/FakeHostControl')

const NOTHING_RESERVED: DisplayMetricsPayload = {
  safeArea: { top: 0, right: 0, bottom: 0, left: 0 },
  hostReserved: { edge: 'right', rect: { x: 0, y: 0, w: 0, h: 0 } },
  orientation: 'landscape',
  fullscreen: false,
  scale: 1,
}
const FULL_VOLUME: AudioChange = {
  focus: { state: 'full', reason: 'system' },
  master: { volume: 1, muted: false },
  gain: 1,
}
const NO_ENTITLEMENTS: EntitlementsPayload = { ads: false, items: [], subscriptions: [], devBuild: false }

/** A value the host observes: its current value and every change, ending when Hosting shuts down. */
interface Observed<A> {
  readonly subscribable: Subscribable.Subscribable<A>
  current(): A
  set(value: A): void
}

function observed<A>(initial: A, until: Effect.Effect<void>): Observed<A> {
  let current = initial
  const listeners = new Set<(value: A) => void>()
  return {
    current: () => current,
    set: (value) => {
      current = value
      for (const listener of [...listeners]) listener(value)
    },
    subscribable: Subscribable.make({
      get: Effect.sync(() => current),
      changes: Stream.async<A>((emit) => {
        const listener = (value: A) => void emit.single(value)
        listeners.add(listener)
        void emit.single(current)
        return Effect.sync(() => listeners.delete(listener))
      }).pipe(Stream.interruptWhen(until)),
    }),
  }
}

/** Items pushed while someone listens (no replay), ending when Hosting shuts down. */
function events<A>(until: Effect.Effect<void>): { stream: Stream.Stream<A>; emit(value: A): void } {
  const listeners = new Set<(value: A) => void>()
  return {
    emit: (value) => {
      for (const listener of [...listeners]) listener(value)
    },
    stream: Stream.async<A>((emit) => {
      const listener = (value: A) => void emit.single(value)
      listeners.add(listener)
      return Effect.sync(() => listeners.delete(listener))
    }).pipe(Stream.interruptWhen(until)),
  }
}

/** Throws when a test pushes a payload its contract schema refuses. */
function checked<A>(schema: z.ZodType<A>, what: string, value: A): A {
  const result = schema.safeParse(value)
  if (!result.success) throw new Error(`FakeHostControl.push.${what}: ${result.error.message}`)
  return result.data
}

/**
 * A fake host and the control handle that drives it. `make` builds the game's `Hosting` in a scope; closing the
 * scope shuts it down (later calls fail `CANCELLED`, every stream ends).
 */
export function fakeHosting(options: FakeHostingOptions = {}): {
  readonly control: FakeHostControl
  make(hosting: HostingOptions): Effect.Effect<Hosting, HostError, Scope.Scope>
} {
  const target = options.target ?? 'web'
  const saved = new Map(Object.entries(options.saves ?? {}))
  const failures = new Map<string, ErrorCode>()
  const held = new Map<string, (() => void)[]>()
  const tracked: TrackedEvent[] = []
  const exits: ('player' | 'completed')[] = []
  const fullscreen: boolean[] = []
  const rounds: ({ start: true } | { end: RoundOutcome | undefined })[] = []
  const submits: Submission[] = []
  // Set by `make`: the parts of the live session the control handle reaches.
  let session:
    | {
        readonly ready: Deferred.Deferred<void, HostError>
        readonly push: FakeHostControl['push']
        readonly menu: () => boolean
        readonly close: Effect.Effect<void>
      }
    | undefined
  const live = () => {
    if (session === undefined) throw new Error('FakeHostControl: the game has not built its Hosting yet')
    return session
  }

  const control: FakeHostControl = {
    welcome: () => void Deferred.unsafeDone(live().ready, Effect.void),
    failReady: (code) =>
      void Deferred.unsafeDone(
        live().ready,
        Effect.fail(new HostError({ code, retryable: false, operation: 'ready' })),
      ),
    push: {
      lifecycle: (payload) => live().push.lifecycle(payload),
      input: (payload) => live().push.input(payload),
      display: (payload) => live().push.display(payload),
      audio: (payload) => live().push.audio(payload),
      entitlements: (payload) => live().push.entitlements(payload),
      savesStatus: (status) => live().push.savesStatus(status),
      savesChanged: (payload) => live().push.savesChanged(payload),
    },
    saved,
    failNext: (operation, code) => void failures.set(operation, code),
    hold: (operation) => void held.set(operation, held.get(operation) ?? []),
    release: (operation) => {
      const waiters = held.get(operation) ?? []
      held.delete(operation)
      for (const resume of waiters) resume()
    },
    tracked,
    exits,
    fullscreen,
    rounds,
    submits,
    requestMenu: () => live().menu(),
    get close() {
      return live().close
    },
  }

  const make = (hostingOptions: HostingOptions): Effect.Effect<Hosting, HostError, Scope.Scope> =>
    Effect.gen(function* () {
      const granted = options.granted
        ? new Set<Capability>(options.granted)
        : defaultGrants(target, hostingOptions.wants)
      const ready = yield* Deferred.make<void, HostError>()
      if (options.deferReady !== true) yield* Deferred.succeed(ready, undefined)
      const shutdown = yield* Deferred.make<void>()
      const until = Deferred.await(shutdown)
      let closed = false
      let isReady = false

      const lifecycle = observed<LifecyclePayload>(
        options.lifecycle ?? { state: 'active', reasons: [] },
        until,
      )
      const input = observed<InputModePayload>(options.input ?? { mode: 'keyboard-mouse' }, until)
      const display = observed(options.display ?? NOTHING_RESERVED, until)
      const audio = observed(options.audio ?? FULL_VOLUME, until)
      const entitlements = observed(options.entitlements ?? NO_ENTITLEMENTS, until)
      const savesStatus = observed<SavesStatus>(options.savesStatus ?? 'saved', until)
      const changed = events<SavesChangedPayload>(until)
      const ended = events<RoundOutcome | undefined>(until)
      const menuHandlers: (() => boolean)[] = []
      const exitHandlers: Effect.Effect<void>[] = []

      const fail = (operation: string, code: ErrorCode) =>
        Effect.fail(new HostError({ code, retryable: code === 'TIMEOUT' || code === 'OFFLINE', operation }))

      /** Every request: closed, held, a planned failure, then the grant, in that order; then `answer`. */
      const request = <A>(operation: string, capability: Capability | undefined, answer: () => A) =>
        Effect.suspend((): Effect.Effect<A, HostError> => {
          if (closed) return fail(operation, 'CANCELLED')
          const waiters = held.get(operation)
          const wait =
            waiters === undefined
              ? Effect.void
              : Effect.async<void>((resume) => {
                  waiters.push(() => resume(Effect.void))
                })
          return Effect.zipRight(
            wait,
            Effect.suspend(() => {
              const planned = failures.get(operation)
              if (planned !== undefined) {
                failures.delete(operation)
                return fail(operation, planned)
              }
              if (capability !== undefined && !granted.has(capability)) {
                return fail(operation, ungrantedCode(target, capability))
              }
              return Effect.sync(answer)
            }),
          )
        })

      let roundOpen = false
      const runExit = Effect.gen(function* () {
        for (const handler of [...exitHandlers]) {
          yield* handler.pipe(
            Effect.catchAllCause((cause) => Effect.logWarning('An exiting handler failed', cause)),
          )
        }
        yield* Effect.ignore(hosting.saves.flush)
      }).pipe(Effect.timeoutOption(HOST_EXIT_CAP), Effect.asVoid)

      const hosting: Hosting = {
        kind: kindOf(target),
        hostName: hostNameOf(target, options.title ?? 'Game'),
        handshake: { fellBack: Option.none() },
        player: options.player ?? { id: 'fake-player', displayName: '' },
        locale: options.locale ?? 'en',
        granted,
        ready: Deferred.await(ready).pipe(Effect.tap(() => Effect.sync(() => (isReady = true)))),
        lifecycle: lifecycle.subscribable,
        input: input.subscribable,
        display: display.subscribable,
        audio: audio.subscribable,
        entitlements: entitlements.subscribable,
        savesStatus: savesStatus.subscribable,
        saves: {
          get: (key) => request('saves.get', 'saves', () => saved.get(key) ?? null),
          set: (key, value) => request('saves.set', 'saves', () => void saved.set(key, value)),
          remove: (key) => request('saves.remove', 'saves', () => void saved.delete(key)),
          flush: request('saves.flush', 'saves', () => ({
            persisted: target === 'ruken' ? ('host-outbox' as const) : ('device' as const),
          })),
          // Code-unit order, as every adapter sorts (M5 spec §4.1).
          keys: request('saves.keys', 'saves', () => [...saved.keys()].sort()),
          changed: changed.stream,
        },
        leaderboards: {
          submit: (board: string, score: number, meta?: LeaderboardSubmitMeta) =>
            request('leaderboard.submit', 'leaderboards', () => {
              submits.push({ board, score, meta })
              return { accepted: true, personalBest: score }
            }),
          get: (_board: string, _query?: LeaderboardQuery) =>
            request('leaderboard.get', 'leaderboards', () => ({ entries: [] })),
        },
        setFullscreen: (on) =>
          request('display.fullscreen', undefined, () => {
            fullscreen.push(on)
            display.set({ ...display.current(), fullscreen: on })
            return { fullscreen: on, support: 'element' as const }
          }),
        round: {
          start: Effect.sync(() => {
            if (roundOpen) return
            roundOpen = true
            rounds.push({ start: true })
          }),
          end: (outcome) =>
            Effect.sync(() => {
              if (!roundOpen) return
              roundOpen = false
              rounds.push({ end: outcome })
              ended.emit(outcome)
            }),
          ended: ended.stream,
        },
        track: (event, props) =>
          Effect.sync(() => {
            const disclosed = hostingOptions.disclosedEvents?.includes(event) ?? true
            if (options.consent !== false && granted.has('analytics.custom') && disclosed) {
              tracked.push({ event, props })
            }
          }),
        exit: (reason = 'player') =>
          request('session.exit', 'exit', () => {
            exits.push(reason)
          }).pipe(Effect.zipLeft(runExit)),
        onMenuRequest: (handler) =>
          Effect.acquireRelease(
            Effect.sync(() => void menuHandlers.push(handler)),
            () => Effect.sync(() => void menuHandlers.splice(menuHandlers.lastIndexOf(handler), 1)),
          ),
        onExiting: (handler) =>
          Effect.acquireRelease(
            Effect.sync(() => void exitHandlers.push(handler)),
            () => Effect.sync(() => void exitHandlers.splice(exitHandlers.lastIndexOf(handler), 1)),
          ),
      }

      session = {
        ready,
        push: {
          lifecycle: (payload) => lifecycle.set(checked(LifecyclePayloadSchema, 'lifecycle', payload)),
          input: (payload) => input.set(checked(InputModePayloadSchema, 'input', payload)),
          display: (payload) => display.set(checked(DisplayMetricsPayloadSchema, 'display', payload)),
          audio: (payload) => audio.set(checked(AudioChangeSchema, 'audio', payload)),
          entitlements: (payload) =>
            entitlements.set(checked(EntitlementsPayloadSchema, 'entitlements', payload)),
          savesStatus: (status) => savesStatus.set(checked(SavesStatusSchema, 'savesStatus', status)),
          savesChanged: (payload) => {
            const change = checked(SavesChangedPayloadSchema, 'savesChanged', payload)
            if (change.value === null) saved.delete(change.key)
            else saved.set(change.key, change.value)
            changed.emit(change)
          },
        },
        menu: () => (isReady ? (menuHandlers.at(-1)?.() ?? false) : false),
        close: runExit,
      }

      yield* Effect.addFinalizer(() =>
        Effect.sync(() => {
          closed = true
        }).pipe(Effect.zipRight(Deferred.succeed(shutdown, undefined))),
      )
      return hosting
    })

  return { control, make }
}

/**
 * The fake host as a layer: `Hosting` for the game (built from `hosting`, default a game that wants saves) and
 * `FakeHostControl` for the test. Both are released when the layer's scope closes.
 */
export function FakeHosting(
  options: FakeHostingOptions = {},
  hosting: HostingOptions = { gameId: 'fake-game', wants: ['saves'], pauseBehavior: 'pause' },
): Layer.Layer<Hosting | FakeHostControl, HostError> {
  const fake = fakeHosting(options)
  return Layer.merge(Layer.scoped(Hosting, fake.make(hosting)), Layer.succeed(FakeHostControl, fake.control))
}
