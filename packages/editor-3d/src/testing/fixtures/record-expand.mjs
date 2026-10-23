// Records `expand.golden.json`: The Last Light's own `expand` run over the four shipped blockouts.
// It reads the Last Light checkout and writes nothing there. Run with Node 22.18 or later:
//
//   node --experimental-strip-types src/testing/fixtures/record-expand.mjs <Last Light checkout at 92e6704> src/testing/fixtures/expand.golden.json
import { readFileSync, writeFileSync } from 'node:fs'

const [checkout, out] = process.argv.slice(2)
const { expand } = await import(`${checkout}/scripts/pipeline/blockout-format.ts`)

const golden = {}
for (const name of ['clinic', 'clinic-dawn', 'bay', 'prologue']) {
  const blockout = JSON.parse(readFileSync(`${checkout}/docs/art/blockout-${name}/blockout.json`, 'utf8'))
  // The golden is JSON, so it writes -0 as 0: round-trip before comparing.
  golden[`blockout-${name}`] = JSON.parse(JSON.stringify(expand(blockout)))
}
writeFileSync(out, `${JSON.stringify(golden)}\n`)
