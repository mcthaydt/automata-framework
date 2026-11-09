import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { Effect } from 'effect'
import { runMain } from '../app/main.ts'
import { holdTarget } from '../shared/project.ts'

// A process that holds a target's lock until a signal ends it, as a long `automata-pipe run` would (locks.test.ts).
const dir = process.argv[2] as string
runMain(
  Effect.scoped(
    Effect.gen(function* () {
      yield* Effect.orDie(holdTarget(dir))
      writeFileSync(join(dir, 'held'), '')
      return yield* Effect.never
    }),
  ),
  () => undefined,
)
