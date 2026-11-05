// TEMPORARY (task 5.3 to 5.4): the plain `Hosting` (plain-hosting.ts) seen as the Effect `Hosting` the runtime still
// reads. Task 5.4 converts the runtime to the plain one, one feature at a time, and then deletes this file together
// with `errors.ts`, `hosting.ts` and `lib/effect-subscribable.ts`.
import {
  Deferred,
  Effect,
  Clock as EffectClock,
  Fiber,
  Layer,
  Option,
  Runtime,
  type Scope,
  Stream,
  Subscribable,
} from 'effect'
import type { Clock } from '../lib/clock'
import { ok } from '../lib/result'
import type { Listenable, Subscribable as PlainSubscribable } from '../lib/subscribable'
import { HostError, HostHandshakeFailed } from './errors'
import { type Hosting as EffectHosting, type HostingOptions, Hosting as HostingTag } from './hosting'
import { type HostResult, refuse } from './plain-errors'
import type { Hosting, HostingSaves } from './plain-hosting'

/** The Effect constructor of an adapter, as the target entries expose it. */
export type MakeHosting<Seams> = (
  options: HostingOptions,
  seams?: Seams,
) => Effect.Effect<EffectHosting, HostError, Scope.Scope>

/** The Effect layer of an adapter, as the target entries expose it. */
export type HostingLayer<Seams> = (
  options: HostingOptions,
  seams?: Seams,
) => Layer.Layer<EffectHosting, HostError>

/** A plain host call as an Effect: a refusal becomes the tagged `HostError` it used to be. */
function fromResult<A>(call: () => Promise<HostResult<A>>): Effect.Effect<A, HostError> {
  return Effect.flatMap(Effect.promise(call), (result) =>
    result.ok ? Effect.succeed(result.value) : Effect.fail(new HostError(result.reason)),
  )
}

/** `Effect`'s clock as the plain `Clock`, so a `TestClock` adjustment still fires the adapters' timeouts. */
export function effectClock(runtime: Runtime.Runtime<never>): Clock {
  const fibers = new Map<unknown, Fiber.RuntimeFiber<unknown>>()
  let nextId = 0
  return {
    now: () => Runtime.runSync(runtime)(EffectClock.currentTimeMillis),
    setTimeout(callback, ms) {
      const id = nextId++
      const fiber = Runtime.runFork(runtime)(
        Effect.sleep(ms).pipe(
          Effect.zipRight(Effect.sync(callback)),
          Effect.ensuring(Effect.sync(() => void fibers.delete(id))),
        ),
      )
      fibers.set(id, fiber)
      return id
    },
    clearTimeout(handle) {
      const fiber = fibers.get(handle)
      fibers.delete(handle)
      if (fiber !== undefined) Runtime.runFork(runtime)(Fiber.interrupt(fiber))
    },
  }
}

/** The plain `Hosting` as the Effect one. `shutdown` completes when the host is disposed, ending every stream. */
export function toEffectHosting(
  plain: Hosting,
  shutdown: Deferred.Deferred<void>,
): Effect.Effect<EffectHosting> {
  return Effect.gen(function* () {
    const runtime = yield* Effect.runtime<never>()
    const until = Deferred.await(shutdown)
    const changes = <A>(source: Pick<Listenable<A>, 'subscribe'>) =>
      Stream.async<A>((emit) => {
        const stop = source.subscribe((value) => void emit.single(value))
        return Effect.sync(stop)
      }).pipe(Stream.interruptWhen(until))
    const observed = <A>(source: PlainSubscribable<A>) =>
      Subscribable.make({ get: Effect.sync(() => source.get()), changes: changes(source) })

    return {
      kind: plain.kind,
      hostName: plain.hostName,
      handshake: {
        fellBack:
          plain.handshake.fellBack === null
            ? Option.none()
            : Option.some(new HostHandshakeFailed(plain.handshake.fellBack)),
      },
      player: plain.player,
      locale: plain.locale,
      granted: plain.granted,
      ready: fromResult(() => plain.ready),
      lifecycle: observed(plain.lifecycle),
      input: observed(plain.input),
      display: observed(plain.display),
      audio: observed(plain.audio),
      entitlements: observed(plain.entitlements),
      savesStatus: observed(plain.savesStatus),
      saves: {
        get: (key) => fromResult(() => plain.saves.get(key)),
        set: (key, value) => fromResult(() => plain.saves.set(key, value)),
        remove: (key) => fromResult(() => plain.saves.remove(key)),
        flush: fromResult(() => plain.saves.flush()),
        keys: fromResult(() => plain.saves.keys()),
        changed: changes(plain.saves.changed),
      },
      leaderboards: {
        submit: (board, score, meta) => fromResult(() => plain.leaderboards.submit(board, score, meta)),
        get: (board, query) => fromResult(() => plain.leaderboards.get(board, query)),
      },
      setFullscreen: (on) => fromResult(() => plain.setFullscreen(on)),
      round: {
        start: Effect.sync(() => plain.round.start()),
        end: (outcome) => Effect.sync(() => plain.round.end(outcome)),
        ended: changes(plain.round.ended),
      },
      track: (event, props) => Effect.sync(() => plain.track(event, props)),
      exit: (reason) => fromResult(() => plain.exit(reason)),
      onMenuRequest: (handler) =>
        Effect.acquireRelease(
          Effect.sync(() => plain.onMenuRequest(handler)),
          (takeBack) => Effect.sync(takeBack),
        ).pipe(Effect.asVoid),
      // The handler is an Effect; it runs on the runtime Hosting was built on, so it sees the same clock.
      onExiting: (handler) =>
        Effect.acquireRelease(
          Effect.sync(() => plain.onExiting(() => Runtime.runPromise(runtime)(handler))),
          (takeBack) => Effect.sync(takeBack),
        ).pipe(Effect.asVoid),
    } satisfies EffectHosting
  })
}

/**
 * An adapter's plain constructor as the Effect one the runtime and the target entries still expose: the plain
 * `Hosting` lives as long as the scope; a refusal at construction is the `HostError` it used to be. Interrupting the
 * build aborts the handshake.
 */
export function bridgeHosting<Seams>(
  create: (
    options: HostingOptions,
    seams: Seams & { clock: Clock; signal: AbortSignal },
  ) => Promise<HostResult<Hosting>>,
): MakeHosting<Seams> {
  return (options, seams) =>
    Effect.gen(function* () {
      const runtime = yield* Effect.runtime<never>()
      const abort = new AbortController()
      const result = yield* Effect.async<HostResult<Hosting>>((resume) => {
        void create(options, { ...seams, clock: effectClock(runtime), signal: abort.signal } as Seams & {
          clock: Clock
          signal: AbortSignal
        }).then((made) => resume(Effect.succeed(made)))
        return Effect.sync(() => abort.abort())
      })
      if (!result.ok) return yield* Effect.fail(new HostError(result.reason))
      const plain = result.value
      const shutdown = yield* Deferred.make<void>()
      // Hosting shuts down first, then every stream ends (the order the Effect version kept).
      yield* Effect.addFinalizer(() =>
        Effect.sync(() => plain.dispose()).pipe(Effect.zipRight(Deferred.succeed(shutdown, undefined))),
      )
      return yield* toEffectHosting(plain, shutdown)
    })
}

/** A plain fake `Hosting` (testing/host/fake-hosting.ts) as the Effect one, living as long as the scope. */
export function bridgeFakeHosting(
  create: (clock: Clock) => Hosting,
): Effect.Effect<EffectHosting, never, Scope.Scope> {
  return Effect.gen(function* () {
    const runtime = yield* Effect.runtime<never>()
    const plain = create(effectClock(runtime))
    const shutdown = yield* Deferred.make<void>()
    yield* Effect.addFinalizer(() =>
      Effect.sync(() => plain.dispose()).pipe(Effect.zipRight(Deferred.succeed(shutdown, undefined))),
    )
    return yield* toEffectHosting(plain, shutdown)
  })
}

/** The Effect layer over a bridged constructor, as `HostingLive` was. */
export function bridgeLayer<Seams>(make: MakeHosting<Seams>): HostingLayer<Seams> {
  return (options, seams) => Layer.scoped(HostingTag, make(options, seams))
}

/**
 * The other way round: the Effect `Hosting.saves` the runtime still holds, seen as the plain calls a feature that is
 * already converted takes (the locale). A failure comes back as the refusal it carries.
 */
export function plainSaves(saves: EffectHosting['saves']): Pick<HostingSaves, 'get' | 'set' | 'remove'> {
  const run = <A>(call: Effect.Effect<A, HostError>): Promise<HostResult<A>> =>
    Effect.runPromise(
      Effect.match(call, {
        onSuccess: (value): HostResult<A> => ok(value),
        onFailure: (error): HostResult<A> =>
          refuse(error.code, error.retryable, error.operation, error.cause),
      }),
    )
  return {
    get: (key) => run(saves.get(key)),
    set: (key, value) => run(saves.set(key, value)),
    remove: (key) => run(saves.remove(key)),
  }
}

/** The Effect `Hosting.ready` as the plain promise a converted feature waits on. */
export function plainReady(ready: EffectHosting['ready']): Promise<HostResult<void>> {
  return Effect.runPromise(
    Effect.match(ready, {
      onSuccess: (): HostResult<void> => ok(undefined),
      onFailure: (error): HostResult<void> =>
        refuse(error.code, error.retryable, error.operation, error.cause),
    }),
  )
}

/** An Effect `Subscribable` the runtime still holds as the plain one (its current value, then each change). */
export function plainObserved<A>(source: Subscribable.Subscribable<A>): PlainSubscribable<A> {
  return {
    get: () => Effect.runSync(source.get),
    subscribe(listener) {
      const fiber = Effect.runFork(
        Stream.runForEach(source.changes, (value) => Effect.sync(() => listener(value))),
      )
      return () => void Effect.runFork(Fiber.interrupt(fiber))
    },
  }
}

/** What the audio service listens to, from the Effect `Hosting`. */
export function plainAudioHosting(
  hosting: Pick<EffectHosting, 'ready' | 'lifecycle' | 'audio'>,
): Pick<Hosting, 'ready' | 'lifecycle' | 'audio'> {
  return {
    ready: plainReady(hosting.ready),
    lifecycle: plainObserved(hosting.lifecycle),
    audio: plainObserved(hosting.audio),
  }
}
