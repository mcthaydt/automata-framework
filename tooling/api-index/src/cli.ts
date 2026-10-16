// Usage: pnpm api-index (after pnpm build). Writes tooling/api-index/dist/{api.json,api.md,llms-api.txt,
// llms-full.txt} and fails on an export with no doc comment that undocumented-baseline.json does not list.
import { fileURLToPath } from 'node:url'
import { CORPUS } from './corpus.ts'
import { runApiIndex } from './run.ts'

const root = fileURLToPath(new URL('../../..', import.meta.url))
const result = runApiIndex({
  root,
  out: fileURLToPath(new URL('../dist', import.meta.url)),
  corpus: CORPUS,
  baseline: fileURLToPath(new URL('../undocumented-baseline.json', import.meta.url)),
})
for (const line of result.report) (result.exitCode === 0 ? console.log : console.error)(line)
process.exitCode = result.exitCode
