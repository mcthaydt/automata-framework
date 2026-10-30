#!/usr/bin/env node
import { FilesLive, ProcessRunnerLive } from '@mcthaydt/automata-node'
import { Effect, Layer } from 'effect'
import { isAgent } from './agent.ts'
import { runMain } from './main.ts'
import { REGISTERED } from './registry.ts'
import { PLANNED, route } from './router.ts'

// The `automata-pipe` bin, run by Node from source. An agent (plan D1) may not approve or reject a gate. Ctrl-C and
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
