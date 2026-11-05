import { fakeHosting } from '#src/testing/host/index.ts'
import { describeHostingContract } from '../../../../src/testing/host/contract-suite.ts'

// DIST-c: the cases every adapter passes, on the fake host for each target, so the fake cannot drift from the real
// adapters (DIST spec §7).

/** Lets pending promises finish (one macrotask), as the web adapter's run settles. */
const delivered = (): Promise<void> => new Promise<void>((resolve) => setTimeout(resolve, 0))

for (const target of ['web', 'itch', 'ruken', 'tauri'] as const) {
  describeHostingContract(
    `the fake host as the ${target} target`,
    () =>
      fakeHosting({ target }).create({ gameId: 'contract-game', wants: ['saves'], pauseBehavior: 'pause' }),
    delivered,
  )
}
