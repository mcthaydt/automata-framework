#!/usr/bin/env node
import { FilesLive, ProcessRunnerLive } from '@mcthaydt/automata-node'
import { Effect, Layer } from 'effect'
import { isAgent } from './agent.ts'
import { REGISTERED } from './registry.ts'
import { PLANNED, route } from './router.ts'

// The `automata-pipe` bin, run by Node from source. An agent (plan D1) may not approve or reject a gate.

const output = await Effect.runPromise(
  route(process.argv.slice(2), REGISTERED, PLANNED, { agent: isAgent(process.env), env: process.env }).pipe(
    Effect.provide(Layer.merge(FilesLive, ProcessRunnerLive)),
  ),
)
process.stdout.write(output.stdout)
process.stderr.write(output.stderr)
process.exitCode = output.exit
