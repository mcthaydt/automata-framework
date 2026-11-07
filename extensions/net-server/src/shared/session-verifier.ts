/**
 * Who a joining player is.
 *
 * A port: the room hands it the session token a client presents (`JoinOptions.session`) and seats the client only if
 * it verifies. Ruken has no server credential yet, so production runs with `anonymousVerifier`, which accepts
 * every join and names nobody; nothing durable may be keyed by its answer. The fake verifies test tokens it issued
 * itself, so a test can show a forged or expired token refused. It is a test switch: a production server
 * refuses to start with it (`process-safety.ts`). A host's verifier is given in the config.
 */

import { type Cause, Clock, Data, Effect } from 'effect'

/** Why a token was refused: none was given, it was never issued, or it has expired. */
export type SessionRejectReason = 'missing' | 'forged' | 'expired'

type TaggedErrorClass<Tag extends string, Fields> = new (
  fields: Fields,
) => Cause.YieldableError & { readonly _tag: Tag } & Readonly<Fields>

const SessionRejectedBase: TaggedErrorClass<'SessionRejected', { readonly reason: SessionRejectReason }> =
  Data.TaggedError('SessionRejected')

/** The verifier refused the token; the room refuses the join `UNVERIFIED`. */
export class SessionRejected extends SessionRejectedBase {}

export interface VerifiedSession {
  readonly playerId: string
}

export interface SessionVerifier {
  verify(token: string): Effect.Effect<VerifiedSession, SessionRejected>
}

/** Accepts every join and names nobody: the only verifier production has until a host gives its own. */
export const anonymousVerifier: SessionVerifier = {
  verify: () => Effect.succeed({ playerId: 'anonymous' }),
}

export interface FakeVerifier extends SessionVerifier {
  /** A token this verifier accepts for `playerId` until `expiresAtMs` on Effect's `Clock`. */
  issue(playerId: string, options: { readonly expiresAtMs: number }): string
}

const testVerifiers = new WeakSet<SessionVerifier>()
let fakeInstances = 0

/** Whether a verifier is a test switch, which a production server refuses (`process-safety.ts`). */
export function isTestVerifier(verifier: SessionVerifier): boolean {
  return testVerifiers.has(verifier)
}

/**
 * Verifies only the tokens it issued: any other is `forged`, an empty one `missing`, and one at or past its expiry
 * `expired`. Each fake numbers its tokens under its own prefix, so two fakes never accept each other's.
 */
export function createFakeVerifier(): FakeVerifier {
  fakeInstances += 1
  const prefix = `fake-session-${fakeInstances}-`
  const issued = new Map<string, { readonly playerId: string; readonly expiresAtMs: number }>()
  const verifier: FakeVerifier = {
    issue(playerId, options) {
      const token = `${prefix}${issued.size + 1}`
      issued.set(token, { playerId, expiresAtMs: options.expiresAtMs })
      return token
    },
    verify: (token) =>
      Effect.gen(function* () {
        if (token === '') return yield* new SessionRejected({ reason: 'missing' })
        const session = issued.get(token)
        if (session === undefined) return yield* new SessionRejected({ reason: 'forged' })
        if ((yield* Clock.currentTimeMillis) >= session.expiresAtMs)
          return yield* new SessionRejected({ reason: 'expired' })
        return { playerId: session.playerId }
      }),
  }
  testVerifiers.add(verifier)
  return verifier
}
