import { describeHostingContract } from '#src/testing/host/contract-suite.ts'
import { fakeHosting } from '#src/testing/host/index.ts'
import { defaultGrants } from '#src/testing/host/target-grants.ts'

// DIST-c: the cases every adapter passes, on the fake host for each target, so the fake cannot drift from the real
// adapters (DIST spec §7).

/** Lets pending promises finish (one macrotask), as the web adapter's run settles. */
const delivered = (): Promise<void> => new Promise<void>((resolve) => setTimeout(resolve, 0))

const GAME = { gameId: 'contract-game', wants: ['saves'], pauseBehavior: 'pause' } as const

for (const target of ['web', 'itch', 'ruken', 'tauri'] as const) {
  // Ruken grants `links` when the game asks; the other targets always have somewhere to open a page.
  const wants = ['saves', 'links'] as const
  let host: ReturnType<typeof fakeHosting> | undefined
  describeHostingContract(
    `the fake host as the ${target} target`,
    () => fakeHosting({ target }).create(GAME),
    delivered,
    {
      create: () => {
        host = fakeHosting({ target })
        return host.create({ ...GAME, wants })
      },
      createWithoutGrant: () => {
        const without = [...defaultGrants(target, GAME.wants)].filter((capability) => capability !== 'links')
        host = fakeHosting({ target, granted: without })
        return host.create(GAME)
      },
      opened: () => host?.control.opened ?? [],
      decline: () => host?.control.answerLinks('refuse'),
    },
  )
}
