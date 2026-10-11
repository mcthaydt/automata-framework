#!/usr/bin/env node
// The `automata-content` bin. Node runs this file directly (it strips the type annotations), but the rest
// of the package is TypeScript with extensionless imports, which Node cannot load. So this file loads
// `run-cli.ts` through Vite's module runner, the same way the CLI loads `automata.content.ts`.

import { runnerImport } from 'vite'

type RunCli = (argv: readonly string[], cwd: string) => Promise<number>

const { module } = await runnerImport<{ runCli: RunCli }>(new URL('./run-cli.ts', import.meta.url).pathname, {
  configFile: false,
  logLevel: 'silent',
})
process.exitCode = await module.runCli(process.argv.slice(2), process.cwd())
