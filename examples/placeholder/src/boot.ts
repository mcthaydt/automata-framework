import type { HostError, Hosting, HostingSeams } from '@mcthaydt/automata-host'
import { makeHosting } from '@mcthaydt/automata-host/target'
import { Data, Effect, type Scope } from 'effect'

// The placeholder's whole boot: `Hosting`, then one line of text and a visit count. It is the ship lane's proof
// that a build made by AF's pipeline completes Ruken's handshake (ship spec §1, item 5) and renders nothing before
// the host says ready (Ruken R-04), and PUB.3's proof that the same game runs as an itch.io build: the build's
// target picks the adapter (`@mcthaydt/automata-host/target`, PUB spec §3), and this file does not know which.

/** Must equal `[game] id` in ship.config.ts; Ruken checks it. */
export const GAME_ID = 'placeholder'

/** What the player sees when the browser keeps the game from saving (PUB spec §3.1: no silent fallback). */
export const BLOCKED_STORAGE_NOTICE = 'Progress won’t be saved in this browser.'

/** The handshake or the wait for ready failed (the host's error is kept as the cause). */
export class PlaceholderBootFailed extends Data.TaggedError('PlaceholderBootFailed')<{
  readonly step: 'init' | 'ready'
  readonly cause: unknown
}> {}

type Text = { textContent: string | null }

export interface BootOptions {
  /** Where the line of text goes (the page's #game element; a plain object in tests). */
  readonly root: Text
  /** Where the visit count, or the blocked-storage notice, goes (#saves). */
  readonly saves: Text
  /** The fake host's environment in tests; the real window when omitted. */
  readonly seams?: HostingSeams | undefined
}

/** Boots and returns `Hosting`, which lives as long as the scope (the page's, in main.ts). */
export function boot(options: BootOptions): Effect.Effect<Hosting, PlaceholderBootFailed, Scope.Scope> {
  return Effect.gen(function* () {
    const hosting = yield* makeHosting(
      { gameId: GAME_ID, wants: ['saves'], pauseBehavior: 'pause' },
      options.seams,
    ).pipe(Effect.mapError((cause) => new PlaceholderBootFailed({ step: 'init', cause })))
    yield* hosting.ready.pipe(Effect.mapError((cause) => new PlaceholderBootFailed({ step: 'ready', cause })))
    options.root.textContent = greeting(hosting.player.displayName)
    options.saves.textContent = yield* countVisit(hosting)
    return hosting
  })
}

/**
 * One more visit in the player's saves, as a line. A host that did not grant `saves` gets the notice, and the
 * game runs on: the web adapter withholds it when the browser blocks storage, and Ruken's SDK would otherwise
 * keep a hosted game's saves in memory without saying so. The SDK's standalone session grants nothing yet saves
 * to the device by design (PUB spec §3.1), so it counts visits.
 */
function countVisit(hosting: Hosting): Effect.Effect<string> {
  if (hosting.kind !== 'standalone' && !hosting.granted.has('saves'))
    return Effect.succeed(BLOCKED_STORAGE_NOTICE)
  return Effect.gen(function* () {
    const saved = Number((yield* hosting.saves.get('visits')) ?? '0')
    const visits = (Number.isSafeInteger(saved) && saved > 0 ? saved : 0) + 1
    yield* hosting.saves.set('visits', String(visits))
    return `Visit ${visits}.`
  }).pipe(
    Effect.catchAll((error: HostError) =>
      Effect.succeed(error.code === 'DENIED' ? BLOCKED_STORAGE_NOTICE : 'Couldn’t save progress.'),
    ),
  )
}

// Standalone (opened outside Ruken, or an itch build) the player has an empty display name.
function greeting(displayName: string): string {
  return displayName === '' ? 'Ready. Hello.' : `Ready. Hello, ${displayName}.`
}
