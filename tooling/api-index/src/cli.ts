// Usage: pnpm api-index [--write] (after pnpm build). Writes tooling/api-index/dist/{api.json,api.md,llms-api.txt,
// llms-full.txt,cheatsheet.md} and fails on an export with no doc comment that undocumented-baseline.json does not
// list, or when a committed output is stale: docs/cheatsheet.md, the agent package's reference/api.md or its plugin
// version. --write rewrites those three from the same run.
import { fileURLToPath } from 'node:url'
import { CORPUS } from './corpus.ts'
import { runApiIndex } from './run.ts'

const path = (relative: string) => fileURLToPath(new URL(`../../../${relative}`, import.meta.url))
const result = runApiIndex({
  root: path(''),
  out: fileURLToPath(new URL('../dist', import.meta.url)),
  corpus: CORPUS,
  baseline: fileURLToPath(new URL('../undocumented-baseline.json', import.meta.url)),
  committed: {
    cheatsheet: path('docs/cheatsheet.md'),
    agentReference: path('agents/automata/skills/automata-api/reference/api.md'),
    pluginManifest: path('agents/automata/.claude-plugin/plugin.json'),
    write: process.argv.includes('--write'),
  },
})
for (const line of result.report) (result.exitCode === 0 ? console.log : console.error)(line)
process.exitCode = result.exitCode
