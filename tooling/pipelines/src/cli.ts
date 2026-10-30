#!/usr/bin/env node
import { FilesLive, ProcessRunnerLive } from '@mcthaydt/automata-node'
import { Effect, Layer } from 'effect'
import { route } from './router.ts'

// The `automata-pipe` bin, run by Node from source. No pipeline is registered yet: character and props arrive in
// M3.9 and show as planned (exit 2) until then.

const output = await Effect.runPromise(
  route(process.argv.slice(2), []).pipe(Effect.provide(Layer.merge(FilesLive, ProcessRunnerLive))),
)
process.stdout.write(output.stdout)
process.stderr.write(output.stderr)
process.exitCode = output.exit
