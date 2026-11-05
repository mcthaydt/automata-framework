// The bundle check's entry (PUB spec §3, §7 build row): it imports the host exactly as the runtime's boot does
// (`packages/runtime/src/boot/boot-program.ts`): the contract from `.`, the adapter from `./target`.

import { makeHosting } from '@mcthaydt/automata/target'
import { Effect } from 'effect'
import { HostError } from '../../../../../shared/host/errors.ts'
import { Hosting } from '../../../../../shared/host/hosting.ts'

const boot = Effect.scoped(
  Effect.gen(function* () {
    const hosting = yield* makeHosting({ gameId: 'bundle-check', wants: ['saves'], pauseBehavior: 'pause' })
    yield* Effect.log(hosting.kind, hosting.hostName, Hosting.key)
    return yield* Effect.fail(new HostError({ code: 'CANCELLED', retryable: false, operation: 'fixture' }))
  }),
)
Effect.runFork(boot)
