import { type InitOptions, type InputModePayload, Ruken, type RukenSession, type SdkEnv } from '@ruken/sdk'
import { Duration, Effect, Layer, Option, Runtime, type Scope } from 'effect'
import { HostHandshakeFailed, toHostError } from './errors'
import { Hosting, type HostingOptions } from './hosting.service'
import { makeMenuHandlers } from './menu'
import { guardRounds } from './rounds'
import { fromListener } from './subscribable'

/**
 * How long the game may hold the host's close (FloorFifty `ruken/exit.ts`,
 * Ruken P6 §4 "1 s cap"). Ruken's own grace is 1.5 s
 * (`sdk-host/src/bridge/defaults.ts` `EXIT_GRACE_MS`), so the game always
 * answers before the host gives up on it.
 */
export const HOST_EXIT_CAP: Duration.Duration = Duration.seconds(1)

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
 * Builds `Hosting` over `Ruken.init`. The SDK decides between a hosted session
 * and its standalone one (shared contracts §1.1), enforces grants and limits,
 * and owns the handshake's timing; AF relays what it reports.
 *
 * `Ruken.init` itself rejects only for invalid options (for example a bad
 * `testHostOrigins` entry), which is a bug in the game's build, so that is a
 * defect rather than a typed error.
 */
export function makeHosting(
  options: HostingOptions,
  seams: HostingSeams = {},
): Effect.Effect<Hosting, never, Scope.Scope> {
  return Effect.gen(function* () {
    const menu = makeMenuHandlers()
    const initOptions: InitOptions = {
      gameId: options.gameId,
      wants: options.wants,
      pauseBehavior: options.pauseBehavior,
      testHostOrigins: options.testHostOrigins,
      onMenuRequest: () => menu.answer(),
    }
    const session = yield* Effect.acquireRelease(
      Effect.promise(() => Ruken.init(initOptions, seams.env)),
      (opened) => Effect.sync(() => opened.dispose()),
    )

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

    return hostingOver(session, options, fellBack, menu.register)
  })
}

/** The single `Hosting` layer for games (shared contracts §1.1). */
export function HostingLive(options: HostingOptions, seams: HostingSeams = {}): Layer.Layer<Hosting> {
  return Layer.scoped(Hosting, makeHosting(options, seams))
}

function hostingOver(
  session: RukenSession,
  options: HostingOptions,
  fellBack: Option.Option<HostHandshakeFailed>,
  registerMenuHandler: Hosting['onMenuRequest'],
): Hosting {
  const storage = session.saves.storage
  const rounds = guardRounds({
    start: () => session.round.start(),
    end: (outcome) => session.round.end(outcome),
  })

  return {
    kind: session.hosted ? 'ruken' : 'standalone',
    handshake: { fellBack },
    player: session.player,
    locale: session.locale,
    granted: session.granted,
    ready: Effect.tryPromise({ try: () => session.ready, catch: (cause) => toHostError('ready', cause) }),

    lifecycle: fromListener(
      () => ({ state: session.lifecycle.state, reasons: [...session.lifecycle.reasons] }),
      (onChange) => session.lifecycle.on('change', onChange),
    ),
    input: fromListener<InputModePayload>(
      () => {
        const gamepad = session.input.gamepad
        return gamepad === undefined ? { mode: session.input.mode } : { mode: session.input.mode, gamepad }
      },
      (onChange) => session.input.on('change', onChange),
    ),
    display: fromListener(
      () => session.display.metrics,
      (onChange) => session.display.on('change', onChange),
    ),
    audio: fromListener(
      () => ({ focus: session.audio.focus, master: session.audio.master, gain: session.audio.gain }),
      (onChange) => session.audio.on('change', onChange),
    ),
    entitlements: fromListener(
      () => session.entitlements,
      (onChange) => session.on('entitlements', onChange),
    ),
    savesStatus: fromListener(
      () => session.saves.status,
      (onChange) => session.saves.on('status', onChange),
    ),

    saves: {
      get: (key) =>
        Effect.try({ try: () => storage.getItem(key), catch: (cause) => toHostError('saves.get', cause) }),
      set: (key, value) =>
        Effect.try({
          try: () => storage.setItem(key, value),
          catch: (cause) => toHostError('saves.set', cause),
        }),
      remove: (key) =>
        Effect.try({
          try: () => storage.removeItem(key),
          catch: (cause) => toHostError('saves.remove', cause),
        }),
      flush: Effect.tryPromise({
        try: () => session.saves.flush(),
        catch: (cause) => toHostError('saves.flush', cause),
      }),
    },
    setFullscreen: (on) =>
      Effect.tryPromise({
        try: () => session.display.setFullscreen(on),
        catch: (cause) => toHostError('display.fullscreen', cause),
      }),
    round: {
      start: Effect.sync(() => rounds.start()),
      end: (outcome) => Effect.sync(() => rounds.end(outcome)),
    },
    track: (event, props) =>
      Effect.sync(() => {
        if (options.disclosedEvents !== undefined && !options.disclosedEvents.includes(event)) return
        try {
          session.analytics.track(event, props)
        } catch {
          // The SDK refuses a malformed event by throwing; analytics never break the game.
        }
      }),
    exit: (reason = 'player') =>
      Effect.tryPromise({
        try: () => session.exit({ reason }),
        catch: (cause) => toHostError('session.exit', cause),
      }),
    onMenuRequest: registerMenuHandler,
    onExiting: (handler) =>
      Effect.gen(function* () {
        // The SDK calls exiting listeners as plain promises; run the handler on the
        // caller's runtime so it sees the same Clock (TestClock in tests).
        const runPromise = Runtime.runPromise(yield* Effect.runtime<never>())
        const capped = handler.pipe(
          Effect.timeoutOption(HOST_EXIT_CAP),
          Effect.catchAllCause((cause) => Effect.logWarning('An exiting handler failed', cause)),
          Effect.asVoid,
        )
        yield* Effect.acquireRelease(
          Effect.sync(() => session.on('exiting', () => runPromise(capped))),
          (stop) => Effect.sync(stop),
        )
      }),
  }
}
