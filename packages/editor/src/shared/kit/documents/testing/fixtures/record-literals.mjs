// Records `literals.golden.json`: the number literals the adventure source's own `listJsonLiterals`
// (scripts/pipeline/json-edit.ts, which finds spans with TypeScript's JSON parser) reports for the five shipped files.
// Each entry is [path, start, end]; the text and value come from the fixture itself. the adventure source's TypeScript is 5.9.3:
// copy json-edit.ts next to a node_modules that has `typescript@5.9.3`, then run with Node 22.18 or later:
//
//   node --experimental-strip-types src/documents/testing/fixtures/record-literals.mjs <copy of json-edit.ts> src/documents/testing/fixtures/literals.golden.json
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const [jsonEdit, out] = process.argv.slice(2)
const { listJsonLiterals } = await import(jsonEdit)
const fixtures = fileURLToPath(new URL('.', import.meta.url))

const golden = {}
for (const name of [
  'blockout-clinic',
  'blockout-clinic-dawn',
  'blockout-bay',
  'blockout-prologue',
  'facility',
]) {
  const text = readFileSync(`${fixtures}${name}.json`, 'utf8')
  golden[name] = listJsonLiterals(text).map((literal) => [literal.path, literal.start, literal.end])
}
writeFileSync(out, `${JSON.stringify(golden)}\n`)
