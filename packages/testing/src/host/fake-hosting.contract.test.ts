import { describeHostingContract } from '@mcthaydt/automata-host/contract-suite'
import { Effect } from 'effect'
import { FakeHosting } from './index'

// DIST-c: the cases every adapter passes, on `FakeHosting` for each target, so the fake cannot drift from the real
// adapters (DIST spec §7).

/** Lets forked stream readers subscribe (one macrotask), as the web adapter's run settles. */
const delivered: Effect.Effect<void> = Effect.promise(
  () => new Promise<void>((resolve) => setTimeout(resolve, 0)),
)

for (const target of ['web', 'itch', 'ruken', 'tauri'] as const) {
  describeHostingContract(
    `FakeHosting as the ${target} target`,
    () => FakeHosting({ target }, { gameId: 'contract-game', wants: ['saves'], pauseBehavior: 'pause' }),
    delivered,
  )
}
