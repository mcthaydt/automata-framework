// The bundle check's entry (PUB spec §3, §7 build row): it imports the host exactly as the runtime's boot does
// (`packages/runtime/src/boot/boot-program.ts`): the contract from `.`, the adapter from `./target`.
import { HostError, Hosting } from '@mcthaydt/automata-host'
import { makeHosting } from '@mcthaydt/automata-host/target'
import { Effect } from 'effect'

const boot = Effect.scoped(
  Effect.gen(function* () {
    const hosting = yield* makeHosting({ gameId: 'bundle-check', wants: ['saves'], pauseBehavior: 'pause' })
    yield* Effect.log(hosting.kind, hosting.hostName, Hosting.key)
    return yield* Effect.fail(new HostError({ code: 'CANCELLED', retryable: false, operation: 'fixture' }))
  }),
)
Effect.runFork(boot)
