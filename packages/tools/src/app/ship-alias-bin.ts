#!/usr/bin/env node
import { runShipAlias } from './ship-alias.ts'
// The `automata-ship` bin, the name `automata ship` replaces. See `ship-alias.ts`.
import { runShip } from './ship-cli.ts'

process.exitCode = await runShipAlias(
  process.argv.slice(2),
  (message) => void process.stderr.write(message),
  runShip,
)
