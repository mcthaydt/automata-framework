// One-off converter (M6 spec §4.9): the adventure source's four scenes' line records, dialogue graphs and storylet decks
// become TOML fixtures. A line's text goes to a locale fixture under its id, and the line record keeps that id as its
// text key (NR-D1). Storylets on the source's `radio` trigger (the adventure game's own) are left out and counted. Run
// once against a checkout of the source; it prints the commit it read, which the framework's provenance file records:
//   node --import ./scripts/register-ts.mjs scripts/convert-adventure-narrative.ts <source checkout>
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { stringify } from 'smol-toml'

const source = process.argv[2]
if (source === undefined) throw new Error('usage: convert-adventure-narrative.ts <source checkout>')
const commit = execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
const load = async (path: string): Promise<Record<string, unknown>> => {
  try {
    return (await import(pathToFileURL(join(source, path)).href)) as Record<string, unknown>
  } catch {
    return {}
  }
}
/** TOML has no undefined or null members: they are dropped, as canonical JSON drops undefined. */
const defined = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(defined)
    : value !== null && typeof value === 'object'
      ? Object.fromEntries(
          Object.entries(value)
            .filter(([, v]) => v !== undefined && v !== null)
            .map(([k, v]) => [k, defined(v)]),
        )
      : value
const out = (name: string, header: string, value: Record<string, unknown>) =>
  writeFileSync(
    join(import.meta.dirname, '../src/testing/fixtures', name),
    `# The adventure source's ${header} (provenance: the framework's docs/provenance/sources.md), converted once\n# by packages/narrative/scripts/convert-adventure-narrative.ts. Do not edit.\n${stringify(defined(value) as Record<string, unknown>)}`,
  )

interface Rec {
  id: string
  text: string
  [k: string]: unknown
}
for (const scene of ['prologue', 'clinic', 'clinic-dawn', 'bay']) {
  const story = await load(`src/scenes/${scene}/story.ts`)
  const records = (story.RECORDS as Rec[] | undefined) ?? []
  out(`${scene}.lines.toml`, `${scene} line records`, { lines: records.map((r) => ({ ...r, text: r.id })) })
  out(
    `${scene}.locale.toml`,
    `${scene} line text (en)`,
    Object.fromEntries(records.map((r) => [r.id, r.text])),
  )
  const dialogues =
    ((await load(`src/scenes/${scene}/dialogues.ts`)).DIALOGUES as unknown[] | undefined) ?? []
  out(`${scene}.dialogue.toml`, `${scene} dialogue graphs`, { graphs: dialogues })
  const deck =
    ((await load(`src/scenes/${scene}/storylets.ts`)).STORYLETS as { trigger: string }[] | undefined) ?? []
  const kept = deck.filter((s) => s.trigger !== 'radio')
  out(`${scene}.storylets.toml`, `${scene} storylet deck`, { storylets: kept })
  console.log(
    `${scene}: ${records.length} lines, ${dialogues.length} graphs, ${kept.length} storylets (${deck.length - kept.length} radio left out)`,
  )
}
const canon = (await load('src/narrative/canon.ts')).CANON as Record<string, unknown>
out('canon.toml', 'canon', canon)
console.log(`converted at ${commit}`)
