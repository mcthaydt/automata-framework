import { Effect, type Scope } from 'effect'

/** Runs a test program in a fresh scope, closing it (and every layer built inside) at the end. */
export function runScoped<A, E>(program: Effect.Effect<A, E, Scope.Scope>): Promise<A> {
  return Effect.runPromise(Effect.scoped(program))
}
