#!/usr/bin/env node
// The published `automata-content` bin. The workspace bin, `src/cli/main.ts`, loads `run-cli.ts` through
// Vite's module runner because Node cannot load the package's extensionless TypeScript imports; in the built
// package everything is already JavaScript, so this calls `runCli` directly.
import { runCli } from '../src/app/cli/run-cli'

process.exitCode = await runCli(process.argv.slice(2), process.cwd())
