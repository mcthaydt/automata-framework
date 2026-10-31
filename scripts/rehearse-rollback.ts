// QB.4c: the rollback rehearsal (QB-d). It publishes the build as release A and the same build plus one marker file as
// release B to a release store, checks that B is what is served, rolls back, and checks that A is served again and the
// marker is gone. Each check is check:deployed's (served files, header set, page policies) against serve-static.ts on
// the current release's folder. Until the Owner supplies the host (decision 11) the store is a local folder, laid out
// as an immutable host keeps releases (scripts/release.ts); docs/operations/rollback.md records a run.
//
//   node --import tsx scripts/rehearse-rollback.ts [build] [--store <dir>]
import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { checkDeployed, serveLocally } from './check-deployed'
import { currentRelease, publishRelease, rollBack } from './release'

/** The file only release B has, so the served site says which release it is. */
const MARKER = 'rollback-rehearsal.txt'

/** Serves the store's current release and runs check:deployed on it; also says whether the marker is served. */
async function checkCurrent(store: string): Promise<{ id: string; problems: string[]; marker: boolean }> {
  const id = currentRelease(store)!
  const folder = join(store, 'releases', id)
  const local = await serveLocally(folder)
  try {
    const problems = await checkDeployed(local.origin, folder)
    const marker = (await fetch(`${local.origin}/${MARKER}`)).status === 200
    return { id, problems, marker }
  } finally {
    local.stop()
  }
}

const { values, positionals } = parseArgs({ allowPositionals: true, options: { store: { type: 'string' } } })
const build = resolve(positionals[0] ?? 'build')
const store = resolve(values.store ?? mkdtempSync(join(tmpdir(), 'rollback-store-')))
const fail = (message: string) => { console.error(message); process.exit(1) }

const a = publishRelease(build, store, new Date().toISOString()).id
const withMarker = mkdtempSync(join(tmpdir(), 'rollback-b-'))
let b: string
try {
  cpSync(build, withMarker, { recursive: true })
  writeFileSync(join(withMarker, MARKER), `Release B of the rollback rehearsal, made ${new Date().toISOString()}\n`)
  b = publishRelease(withMarker, store, new Date().toISOString()).id
} finally {
  rmSync(withMarker, { recursive: true, force: true })
}
console.log(`Store ${store}: published A (${a.slice(0, 12)}), then B (${b.slice(0, 12)}).`)

const before = await checkCurrent(store)
if (before.id !== b) fail(`Expected B (${b.slice(0, 12)}) to be current, found ${before.id.slice(0, 12)}`)
if (before.problems.length > 0) fail(before.problems.join('\n'))
if (!before.marker) fail(`B is current but /${MARKER} is not served`)
console.log(`Serving B (${b.slice(0, 12)}): check:deployed passed, the marker is served.`)

const record = rollBack(store, new Date().toISOString())
const after = await checkCurrent(store)
if (record.id !== a || after.id !== a) fail(`Expected the rollback to make A (${a.slice(0, 12)}) current, found ${after.id.slice(0, 12)}`)
if (after.problems.length > 0) fail(after.problems.join('\n'))
if (after.marker) fail(`Rolled back to A but /${MARKER} is still served`)
console.log(`Rolled back to A (${a.slice(0, 12)}): check:deployed passed, the marker is gone.`)
console.log(`History: ${join(store, 'history.json')}`)
