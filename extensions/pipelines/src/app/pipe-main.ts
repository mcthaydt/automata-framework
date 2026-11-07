import { Effect, Layer } from 'effect'
import { isAgent } from '../shared/agent.ts'
import { FilesLive } from '../shared/node/files.ts'
import { ProcessRunnerLive } from '../shared/node/process.ts'
import { PLANNED, route } from '../shared/router.ts'
import { runMain } from './main.ts'
import { REGISTERED } from './registry.ts'

// The `automata-pipe` bin, run by Node from source. An agent may not approve or reject a gate. Ctrl-C and
// SIGTERM interrupt the command, so its locks are released (main.ts).

runMain(
  route(process.argv.slice(2), REGISTERED, PLANNED, { agent: isAgent(process.env), env: process.env }).pipe(
    Effect.provide(Layer.merge(FilesLive, ProcessRunnerLive)),
  ),
  (output) => {
    process.stdout.write(output.stdout)
    process.stderr.write(output.stderr)
    process.exitCode = output.exit
  },
)
