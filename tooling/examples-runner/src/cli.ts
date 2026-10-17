#!/usr/bin/env node
// Usage, from the examples package: `automata-examples dev [name]` serves the index and the fake host its View links
// open, or opens one example by its id (`core-input-keys`); `automata-examples typecheck` typechecks every
// non-pending example (EX spec §5, §7).
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { demoHostPort } from '../host/ports.ts'
import { readCatalog } from './catalog.ts'
import { runTypecheck } from './typecheck.ts'

const root = process.cwd()
const [command, name] = process.argv.slice(2)

if (command === 'typecheck') process.exit(runTypecheck(root, readCatalog(root)))
if (command !== 'dev') {
  console.error('usage: automata-examples dev [name] | typecheck')
  process.exit(2)
}
const entries = readCatalog(root)
const entry = name === undefined ? undefined : entries.find((candidate) => candidate.id === name)
if (name !== undefined && entry === undefined) {
  console.error(
    `automata-examples: no example "${name}"; there are: ${entries.map((e) => e.id).join(', ') || 'none'}`,
  )
  process.exit(2)
}
// The fake host the index's View links open (EX.5), on the port they name.
const host = await createServer({
  configFile: fileURLToPath(new URL('../host/vite.config.ts', import.meta.url)),
  server: { port: demoHostPort, strictPort: true, host: '127.0.0.1' },
})
await host.listen()
const server = await createServer(entry === undefined ? {} : { server: { open: entry.url } })
await server.listen()
server.printUrls()
