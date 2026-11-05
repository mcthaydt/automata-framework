// Run the module-move codemod over the whole repository, by the move map:
//   node tooling/codemods/src/move-modules-cli.ts [--map docs/refactor/move-map.json] [--dry-run] [--surface]
// A dry run prints what would move and what would not (files no row covers, files that would clash), the imports of
// old packages inside the merged packages (`intra`, left for the build step), and with --surface the names each other
// workspace file imports from an old entry (the surface report). It changes nothing. Without --dry-run it moves the
// files with `git mv` and writes the rewritten text; it refuses to start while any file is unmapped or clashes.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { applyModulePlan, type MoveMap, planModules } from '#src/move-modules.ts'

const { values } = parseArgs({
  options: {
    map: { type: 'string', default: 'docs/refactor/move-map.json' },
    'dry-run': { type: 'boolean', default: false },
    surface: { type: 'boolean', default: false },
  },
})

const root = resolve(execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim())
const map = JSON.parse(readFileSync(resolve(root, values.map as string), 'utf8')) as MoveMap
const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8', cwd: root, maxBuffer: 1 << 28 })
  .split('\0')
  .filter(Boolean)
  .map((path) => resolve(root, path))
const plan = planModules(root, map, files)
const rel = (path: string): string => relative(root, path)

console.log(
  `${plan.moves.length} files move, ${plan.removed.length} duplicates are removed, ${plan.rewrites.size} files change text`,
)
if (plan.unmapped.length > 0)
  console.log(`NOT COVERED by any row (${plan.unmapped.length}):\n  ${plan.unmapped.map(rel).join('\n  ')}`)
for (const clash of plan.clashes)
  console.log(`CLASH: ${clash.from.map(rel).join(' and ')} both become ${rel(clash.to)}`)
if (plan.intra.length > 0) {
  const byOld = new Map<string, number>()
  for (const entry of plan.intra) byOld.set(entry.from, (byOld.get(entry.from) ?? 0) + 1)
  console.log(
    `imports of an old package inside the package it merges into, left for the build step (${plan.intra.length}): ${[...byOld].map(([from, count]) => `${from} ${count}`).join(', ')}`,
  )
}
if (values.surface)
  for (const row of plan.surface) console.log(`${row.consumer}: ${row.from} { ${row.names.join(', ')} }`)
else
  console.log(
    `${plan.surface.length} imports of old entries from other workspace files (--surface lists the names)`,
  )

if (plan.unmapped.length > 0 || plan.clashes.length > 0) process.exit(1)
if (!values['dry-run']) {
  applyModulePlan(plan, {
    move: (from, to) => void execFileSync('git', ['mv', from, to], { cwd: root }),
    remove: (path) => void execFileSync('git', ['rm', '-q', path], { cwd: root }),
  })
  console.log('moved with git mv and rewritten; run the unit tests next')
}
