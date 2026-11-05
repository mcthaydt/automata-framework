import {
  type InitOptions,
  type InputModePayload,
  type RoundOutcome,
  Ruken,
  type RukenSession,
  type SavesChangedPayload,
  type SdkEnv,
} from '@ruken/sdk'
import { Deferred, Effect, Layer, Option, Runtime, type Scope, Stream } from 'effect'
import { HostError, HostHandshakeFailed } from '../../../shared/host/errors'
import { HOST_EXIT_CAP, Hosting, type HostingOptions } from '../../../shared/host/hosting'
import { fromListener } from '../../../shared/lib/effect-subscribable'
import { makeExitHandlers } from '../exit-handlers'
import { makeMenuHandlers } from '../menu'
import { guardRounds } from '../rounds'
import { toHostError } from './errors-ruken'

/** Test seams. Games pass nothing; `HostingTest` passes the fake host's in-memory window pair. */
export interface HostingSeams {
  readonly env?: SdkEnv
}

/**
 * True when the page runs inside a frame. Only then does a standalone session
 * mean the handshake failed; a top-level page is standalone by design.
 */
function isFramed(env: SdkEnv | undefined): boolean {
  if (env !== undefined) return !env.isTopLevel
  return typeof window !== 'undefined' && window !== window.top
}

/**
 * `Ruken.init` as an interruptible Effect.
 *
 * Inside a frame that is not Ruken's, the SDK waits up to 10 s for a welcome.
 * Boot may give up sooner by interrupting; the SDK's promise cannot be
 * cancelled, so a session that arrives after the interrupt is disposed at once
 * instead of leaking. `Ruken.init` rejects only for invalid options (for
 * example a bad `testHostOrigins` entry); that becomes a `HostError` for
 * `init`, so boot can show an error state instead of crashing.
 */
function initSession(
  initOptions: InitOptions,
  env: SdkEnv | undefined,
): Effect.Effect<RukenSession, HostError> {
  return Effect.async<RukenSession, HostError>((resume) => {
    let interrupted = false
    Ruken.init(initOptions, env).then(
      (session) => {
        if (interrupted) session.dispose()
        else resume(Effect.succeed(session))
      },
      (cause: unknown) => {
        if (!interrupted) resume(Effect.fail(toHostError('init', cause)))
      },
    )
    return Effect.sync(() => {
      interrupted = true
    })
  })
}

/**
 * Builds `Hosting` over `Ruken.init`. The SDK decides between a hosted session
 * and its standalone one (shared contracts §1.1), enforces grants and limits,
 * and owns the handshake's timing; AF relays what it reports.
 *
 * When the scope closes, in this order: Hosting marks itself closed (later
 * calls fail with `HostError{code:'CANCELLED'}`), every observed stream ends,
 * and then the session is disposed.
 */
export function makeHosting(
  options: HostingOptions,
  seams: HostingSeams = {},
): Effect.Effect<Hosting, HostError, Scope.Scope> {
  return Effect.gen(function* () {
    const menu = makeMenuHandlers()
    const initOptions: InitOptions = {
      gameId: options.gameId,
      wants: options.wants,
      pauseBehavior: options.pauseBehavior,
      testHostOrigins: options.testHostOrigins,
      onMenuRequest: () => menu.answer(),
    }
    // The handshake itself may be interrupted; once a session exists, its disposal
    // is registered before anything else can interrupt.
    const session = yield* Effect.uninterruptibleMask((restore) =>
      restore(initSession(initOptions, seams.env)).pipe(
        Effect.tap((opened) => Effect.addFinalizer(() => Effect.sync(() => opened.dispose()))),
      ),
    )

    // Registered after the session's disposal, so it runs before it (finalizers run in reverse).
    const shutdown = yield* Deferred.make<void>()
    let open = true
    yield* Effect.addFinalizer(() =>
      Effect.sync(() => {
        open = false
      }).pipe(Effect.zipRight(Deferred.succeed(shutdown, undefined))),
    )

    // Handlers answer the host's menu only once the session is ready (see menu.ts).
    // `ready` rejecting means the session is unusable anyway, so the menu simply stays refused.
    void session.ready.then(menu.markReady, () => undefined)

    const fellBack =
      !session.hosted && isFramed(seams.env)
        ? Option.some(new HostHandshakeFailed({ reason: 'no-welcome' }))
        : Option.none()
    if (Option.isSome(fellBack)) {
      yield* Effect.logWarning(
        'Ruken handshake failed inside a frame; the game runs standalone',
        fellBack.value,
      )
    }

    const exits = makeExitHandlers(HOST_EXIT_CAP)
    const hosting = hostingOver(session, options, {
      fellBack,
      registerMenuHandler: menu.register,
      registerExitHandler: exits.register,
      isOpen: () => open,
      shutdown: Deferred.await(shutdown),
    })

    // The SDK calls its exiting listeners as plain promises and all at once; AF
    // has the one listener and orders the work (see exit-handlers.ts). It runs on
    // Hosting's own runtime so it sees the same Clock (TestClock in tests).
    // FloorFifty `ruken/exit.ts`: after the game's handlers, every save still on
    // its way is handed to the host, within HOST_EXIT_CAP. A flush the host
    // refuses (no `saves` grant) or that times out is simply over.
    const runPromise = Runtime.runPromise(yield* Effect.runtime<never>())
    yield* Effect.acquireRelease(
      Effect.sync(() =>
        session.on('exiting', () => runPromise(exits.run(Effect.ignore(hosting.saves.flush)))),
      ),
      (stop) => Effect.sync(stop),
    )

    return hosting
  })
}

/** The single `Hosting` layer for games (shared contracts §1.1). */
export function HostingLive(
  options: HostingOptions,
  seams: HostingSeams = {},
): Layer.Layer<Hosting, HostError> {
  return Layer.scoped(Hosting, makeHosting(options, seams))
}

interface HostingState {
  readonly fellBack: Option.Option<HostHandshakeFailed>
  readonly registerMenuHandler: Hosting['onMenuRequest']
  readonly registerExitHandler: Hosting['onExiting']
  readonly isOpen: () => boolean
  /** Completes when Hosting shuts down; every observed stream ends then. */
  readonly shutdown: Effect.Effect<void>
}

function hostingOver(session: RukenSession, options: HostingOptions, state: HostingState): Hosting {
  const storage = session.saves.storage
  const roundEndListeners = new Set<(outcome: RoundOutcome | undefined) => void>()
  // `guardRounds` only forwards the ends it lets through, so listeners hear one per round.
  const rounds = guardRounds({
    start: () => session.round.start(),
    end: (outcome) => {
      session.round.end(outcome)
      for (const listener of [...roundEndListeners]) listener(outcome)
    },
  })

  /** Runs `request` while Hosting is open; afterwards fails it, so nothing is silently dropped. */
  const whileOpen = <A>(
    operation: string,
    request: Effect.Effect<A, HostError>,
  ): Effect.Effect<A, HostError> =>
    Effect.suspend(() =>
      state.isOpen()
        ? request
        : Effect.fail(new HostError({ code: 'CANCELLED', retryable: false, operation })),
    )

  const observe = <A>(current: () => A, listen: (onChange: (value: A) => void) => () => void) =>
    fromListener(current, listen, state.shutdown)

  return {
    kind: session.hosted ? 'ruken' : 'standalone',
    hostName: 'Ruken',
    handshake: { fellBack: state.fellBack },
    player: session.player,
    locale: session.locale,
    granted: session.granted,
    ready: Effect.tryPromise({ try: () => session.ready, catch: (cause) => toHostError('ready', cause) }),

    lifecycle: observe(
      () => ({ state: session.lifecycle.state, reasons: [...session.lifecycle.reasons] }),
      (onChange) => session.lifecycle.on('change', onChange),
    ),
    input: observe<InputModePayload>(
      () => {
        const gamepad = session.input.gamepad
        return gamepad === undefined ? { mode: session.input.mode } : { mode: session.input.mode, gamepad }
      },
      (onChange) => session.input.on('change', onChange),
    ),
    display: observe(
      () => session.display.metrics,
      (onChange) => session.display.on('change', onChange),
    ),
    audio: observe(
      () => ({ focus: session.audio.focus, master: session.audio.master, gain: session.audio.gain }),
      (onChange) => session.audio.on('change', onChange),
    ),
    entitlements: observe(
      () => session.entitlements,
      (onChange) => session.on('entitlements', onChange),
    ),
    savesStatus: observe(
      () => session.saves.status,
      (onChange) => session.saves.on('status', onChange),
    ),

    saves: {
      get: (key) =>
        whileOpen(
          'saves.get',
          Effect.try({ try: () => storage.getItem(key), catch: (cause) => toHostError('saves.get', cause) }),
        ),
      set: (key, value) =>
        whileOpen(
          'saves.set',
          Effect.try({
            try: () => storage.setItem(key, value),
            catch: (cause) => toHostError('saves.set', cause),
          }),
        ),
      remove: (key) =>
        whileOpen(
          'saves.remove',
          Effect.try({
            try: () => storage.removeItem(key),
            catch: (cause) => toHostError('saves.remove', cause),
          }),
        ),
      flush: whileOpen(
        'saves.flush',
        Effect.tryPromise({
          try: () => session.saves.flush(),
          catch: (cause) => toHostError('saves.flush', cause),
        }),
      ),
      keys: whileOpen(
        'saves.keys',
        Effect.try({
          try: () => {
            const keys: string[] = []
            for (let index = 0; index < storage.length; index++) {
              const key = storage.key(index)
              if (key !== null) keys.push(key)
            }
            // Code-unit order, so a slot list reads the same on every engine.
            return keys.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
          },
          catch: (cause) => toHostError('saves.keys', cause),
        }),
      ),
      changed: Stream.async<SavesChangedPayload>((emit) => {
        const stop = session.saves.on('changed', (change) => {
          void emit.single(change)
        })
        return Effect.sync(stop)
      }).pipe(Stream.interruptWhen(state.shutdown)),
    },
    leaderboards: {
      submit: (board, score, meta) =>
        whileOpen(
          'leaderboard.submit',
          Effect.tryPromise({
            try: () => session.leaderboards.submit(board, score, meta),
            catch: (cause) => toHostError('leaderboard.submit', cause),
          }),
        ),
      get: (board, query) =>
        whileOpen(
          'leaderboard.get',
          Effect.tryPromise({
            try: () => session.leaderboards.get(board, query),
            catch: (cause) => toHostError('leaderboard.get', cause),
          }),
        ),
    },
    setFullscreen: (on) =>
      whileOpen(
        'display.fullscreen',
        Effect.tryPromise({
          try: () => session.display.setFullscreen(on),
          catch: (cause) => toHostError('display.fullscreen', cause),
        }),
      ),
    round: {
      start: Effect.sync(() => rounds.start()),
      end: (outcome) => Effect.sync(() => rounds.end(outcome)),
      ended: Stream.async<RoundOutcome | undefined>((emit) => {
        const listener = (outcome: RoundOutcome | undefined): void => {
          void emit.single(outcome)
        }
        roundEndListeners.add(listener)
        return Effect.sync(() => {
          roundEndListeners.delete(listener)
        })
      }).pipe(Stream.interruptWhen(state.shutdown)),
    },
    track: (event, props) =>
      Effect.suspend(() => {
        if (options.disclosedEvents !== undefined && !options.disclosedEvents.includes(event)) {
          return Effect.logWarning(`track("${event}") dropped: not in the game's disclosed analytics events`)
        }
        try {
          session.analytics.track(event, props)
          return Effect.void
        } catch (cause) {
          // The SDK refuses a malformed event by throwing; analytics never break the game.
          return Effect.logWarning(`track("${event}") dropped: the Ruken SDK refused it`, cause)
        }
      }),
    exit: (reason = 'player') =>
      whileOpen(
        'session.exit',
        Effect.tryPromise({
          try: () => session.exit({ reason }),
          catch: (cause) => toHostError('session.exit', cause),
        }),
      ),
    onMenuRequest: state.registerMenuHandler,
    onExiting: state.registerExitHandler,
  }
}
