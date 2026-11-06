import {
  type InitOptions,
  type InputModePayload,
  type RoundOutcome,
  Ruken,
  type RukenSession,
  type SavesChangedPayload,
  type SdkEnv,
} from '@ruken/sdk'
import { type HostResult, refuse } from '../../../shared/host/errors'
import {
  HOST_EXIT_CAP_MS,
  type Hosting,
  type HostingOptions,
  type HostingSeams,
} from '../../../shared/host/hosting'
import { type Clock, systemClock } from '../../../shared/lib/clock'
import { disposables } from '../../../shared/lib/disposables'
import { ok, refused } from '../../../shared/lib/result'
import { emitter, subscribable } from '../../../shared/lib/subscribable'
import { makeExitHandlers } from '../exit-handlers'
import { makeMenuHandlers } from '../menu'
import { guardRounds } from '../rounds'
import { toRefusal } from './errors-ruken'

/**
 * True when the page runs inside a frame. Only then does a standalone session
 * mean the handshake failed; a top-level page is standalone by design.
 */
function isFramed(env: SdkEnv | undefined): boolean {
  if (env !== undefined) return !env.isTopLevel
  return typeof window !== 'undefined' && window !== window.top
}

/**
 * `Ruken.init` that can be given up on. The SDK's promise cannot be cancelled, so a session that arrives after the
 * abort is disposed at once instead of leaking. `Ruken.init` rejects only for invalid options (for example a bad
 * `testHostOrigins` entry); that becomes a refusal for `init`, so boot can show an error state instead of crashing.
 */
function initSession(
  initOptions: InitOptions,
  env: SdkEnv | undefined,
  signal: AbortSignal | undefined,
): Promise<HostResult<RukenSession>> {
  return new Promise((resolve) => {
    let aborted = signal?.aborted === true
    const cancelled = () => refuse('CANCELLED', false, 'init')
    if (aborted) return resolve(cancelled())
    signal?.addEventListener(
      'abort',
      () => {
        aborted = true
        resolve(cancelled())
      },
      { once: true },
    )
    Ruken.init(initOptions, env).then(
      (session) => {
        if (aborted) session.dispose()
        else resolve(ok(session))
      },
      (cause: unknown) => {
        if (!aborted) resolve(refused({ ...toRefusal('init', cause) }))
      },
    )
  })
}

/**
 * Builds `Hosting` over `Ruken.init`. The SDK decides between a hosted session and its standalone one (shared
 * contracts), enforces grants and limits, and owns the handshake's timing; AF relays what it reports.
 *
 * `dispose()` does, in this order: Hosting marks itself closed (later calls are refused `CANCELLED`), every
 * subscription stops, and then the session is disposed.
 */
export async function createRukenHosting(
  options: HostingOptions,
  seams: HostingSeams = {},
): Promise<HostResult<Hosting>> {
  const menu = makeMenuHandlers()
  const initOptions: InitOptions = {
    gameId: options.gameId,
    wants: options.wants,
    pauseBehavior: options.pauseBehavior,
    testHostOrigins: options.testHostOrigins,
    onMenuRequest: () => menu.answer(),
  }
  const opened = await initSession(initOptions, seams.env as SdkEnv | undefined, seams.signal)
  if (!opened.ok) return opened
  const session = opened.value

  // Finalizers run in reverse: the session is registered first, so it is disposed last.
  const owner = disposables()
  owner.add(() => session.dispose())
  const state = { open: true }
  owner.add(() => {
    state.open = false
  })

  // Handlers answer the host's menu only once the session is ready (see menu.ts).
  // `ready` rejecting means the session is unusable anyway, so the menu simply stays refused.
  void session.ready.then(menu.markReady, () => undefined)

  const fellBack =
    !session.hosted && isFramed(seams.env as SdkEnv | undefined) ? ({ reason: 'no-welcome' } as const) : null
  if (fellBack !== null) {
    console.warn('Ruken handshake failed inside a frame; the game runs standalone', fellBack)
  }

  const exits = makeExitHandlers(HOST_EXIT_CAP_MS, seams.clock ?? systemClock)
  const hosting = hostingOver(session, options, { fellBack, menu, exits, owner, state })

  // The SDK calls its exiting listeners as plain promises and all at once; AF has the one listener and orders the
  // work (see exit-handlers.ts). FloorFifty `ruken/exit.ts`: after the game's handlers, every save still on its way
  // is handed to the host, within HOST_EXIT_CAP_MS. A flush the host refuses (no `saves` grant) or that times out is
  // simply over.
  owner.add(session.on('exiting', () => exits.run(async () => void (await hosting.saves.flush()))))

  return ok(hosting)
}

interface HostingState {
  readonly fellBack: Hosting['handshake']['fellBack']
  readonly menu: ReturnType<typeof makeMenuHandlers>
  readonly exits: ReturnType<typeof makeExitHandlers>
  readonly owner: ReturnType<typeof disposables>
  /** `open` turns false when Hosting is disposed. */
  readonly state: { open: boolean }
}

function hostingOver(session: RukenSession, options: HostingOptions, shared: HostingState): Hosting {
  const { owner, state } = shared
  const storage = session.saves.storage
  const roundEnds = emitter<RoundOutcome | undefined>(owner)
  // `guardRounds` only forwards the ends it lets through, so listeners hear one per round.
  const rounds = guardRounds({
    start: () => session.round.start(),
    end: (outcome) => {
      session.round.end(outcome)
      roundEnds.emit(outcome)
    },
  })

  /** Runs `request` while Hosting is open; afterwards refuses, so nothing is silently dropped. */
  async function whileOpen<A>(operation: string, request: () => A | Promise<A>): Promise<HostResult<A>> {
    if (!state.open) return refuse('CANCELLED', false, operation)
    try {
      return ok(await request())
    } catch (cause) {
      return refused(toRefusal(operation, cause))
    }
  }

  const observe = <A>(current: () => A, listen: (onChange: (value: A) => void) => () => void) =>
    subscribable(current, listen, owner)
  const savesChanged = emitter<SavesChangedPayload>(owner)
  owner.add(session.saves.on('changed', (change) => savesChanged.emit(change)))

  return {
    kind: session.hosted ? 'ruken' : 'standalone',
    hostName: 'Ruken',
    handshake: { fellBack: shared.fellBack },
    player: session.player,
    locale: session.locale,
    granted: session.granted,
    ready: session.ready.then(
      () => ok(undefined),
      (cause: unknown) => refused(toRefusal('ready', cause)),
    ),

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
      get: (key) => whileOpen('saves.get', () => storage.getItem(key)),
      set: (key, value) => whileOpen('saves.set', () => storage.setItem(key, value)),
      remove: (key) => whileOpen('saves.remove', () => storage.removeItem(key)),
      flush: () => whileOpen('saves.flush', () => session.saves.flush()),
      keys: () =>
        whileOpen('saves.keys', () => {
          const keys: string[] = []
          for (let index = 0; index < storage.length; index++) {
            const key = storage.key(index)
            if (key !== null) keys.push(key)
          }
          // Code-unit order, so a slot list reads the same on every engine.
          return keys.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
        }),
      changed: savesChanged.events,
    },
    leaderboards: {
      submit: (board, score, meta) =>
        whileOpen('leaderboard.submit', () => session.leaderboards.submit(board, score, meta)),
      get: (board, query) => whileOpen('leaderboard.get', () => session.leaderboards.get(board, query)),
    },
    setFullscreen: (on) => whileOpen('display.fullscreen', () => session.display.setFullscreen(on)),
    round: {
      start: () => rounds.start(),
      end: (outcome) => rounds.end(outcome),
      ended: roundEnds.events,
    },
    track: (event, props) => {
      if (options.disclosedEvents !== undefined && !options.disclosedEvents.includes(event)) {
        console.warn(`track("${event}") dropped: not in the game's disclosed analytics events`)
        return
      }
      try {
        session.analytics.track(event, props)
      } catch (cause) {
        // The SDK refuses a malformed event by throwing; analytics never break the game.
        console.warn(`track("${event}") dropped: the Ruken SDK refused it`, cause)
      }
    },
    exit: (reason = 'player') => whileOpen('session.exit', () => session.exit({ reason })),
    onMenuRequest: shared.menu.register,
    onExiting: shared.exits.register,
    dispose: () => owner.dispose(),
  }
}
