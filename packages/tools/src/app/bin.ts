#!/usr/bin/env node
// The `automata` bin: create-game, ship, add, check, build, editor. All the logic is in `cli.ts`; this file only
// runs it, so a test can import `runCli` without starting a command.
import { runCli } from './cli.ts'

process.exitCode = await runCli(process.argv.slice(2))
