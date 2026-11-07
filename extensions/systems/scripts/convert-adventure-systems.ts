// One-off converter (M6 spec §4.9): the adventure source's four scenes' systems, TypeScript objects, become `systems`
// TOML fixtures. Hook names stay names; their TypeScript stays the game's. Run once against a checkout of the source;
// it prints the commit it read, which the framework's provenance file records. Not shipped:
//   node --import ./scripts/register-ts.mjs scripts/convert-adventure-systems.ts <source checkout>
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { stringify } from 'smol-toml'

const source = process.argv[2]
if (source === undefined) throw new Error('usage: convert-adventure-systems.ts <source checkout>')
const commit = execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()

/**
 * TOML has no undefined, and canonical content has no Infinity: a member the source left undefined is dropped, and so is
 * an unbounded reach or radius (`Infinity`), which the schema reads as absent (SY-D11).
 */
const defined = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(defined)
    : value !== null && typeof value === 'object'
      ? Object.fromEntries(
          Object.entries(value)
            .filter(([, v]) => v !== undefined && v !== Number.POSITIVE_INFINITY)
            .map(([k, v]) => [k, defined(v)]),
        )
      : value

for (const scene of ['prologue', 'clinic', 'clinic-dawn', 'bay']) {
  const { SYSTEMS } = await import(pathToFileURL(join(source, `src/scenes/${scene}/systems.ts`)).href)
  const header = `# The adventure source's ${scene} systems (provenance: the framework's docs/provenance/sources.md), converted once\n# by packages/systems/scripts/convert-adventure-systems.ts. Do not edit.\n`
  writeFileSync(
    join(import.meta.dirname, '../src/testing/fixtures', `${scene}.systems.toml`),
    header + stringify(defined(SYSTEMS) as Record<string, unknown>),
  )
  const count = (k: string) => SYSTEMS[k].length
  console.log(
    `${scene}: ${count('rules')} rules, ${count('agents')} agents, ${count('scenarios')} scenarios, ${Object.keys(SYSTEMS.tunables).length} tunables`,
  )
}
console.log(`converted at ${commit}`)
