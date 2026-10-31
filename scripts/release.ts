// DX.12: a release of the site is the exact build CI tested, named by its content, so a release never changes once made
// and rolling back is choosing an earlier id (QB.4c). The deploy target is a placeholder until the Owner supplies a
// hosting account, a deploy credential and DNS for automata.ruken.com (decision 11); until then this script only plans
// a release (`--dry-run`) and refuses to publish, so nothing can reach a public host by mistake.
//
//   node --import tsx scripts/release.ts [build] --dry-run [--out release-manifest.json] [--store <dir>]
//   node --import tsx scripts/release.ts --dry-run --rollback --store <dir> [--to <id>]
//
// The dry run prints the release's id, file count and bytes; the manifest it writes lists every file it would upload.
// QB.4c: `--store` also publishes the release into a local release store laid out as an immutable host keeps releases
// (`releases/<id>/`, `history.json`, `current`), and `--rollback` makes the release that was current before current
// again. Until the host exists that store is the only one, so the rollback can be rehearsed (scripts/rehearse-rollback.ts).
import { createHash } from 'node:crypto'
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

export interface ReleaseFile {
  readonly path: string
  readonly bytes: number
  readonly sha256: string
}
export interface ReleaseManifest {
  /** The sha256 of the file list: the same build is the same release, and any changed byte is a new one. */
  readonly id: string
  readonly files: readonly ReleaseFile[]
}

/** The one deploy target. Its name changes, with its credential, when the Owner supplies the host. */
const TARGET = 'placeholder'
const NO_TARGET =
  'No deploy target is configured. DX.12 publishes once the Owner supplies a hosting account, a deploy credential and DNS for automata.ruken.com (decision 11); until then run with --dry-run.'

const sha256 = (data: string | Buffer) => createHash('sha256').update(data).digest('hex')

function filesUnder(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile())
    .map(entry => relative(dir, join(entry.parentPath, entry.name)).split(sep).join('/'))
}

/** Every file under the build, sorted by path (code-unit order, the same on every machine), with its bytes and sha256. */
export function releaseManifest(dir: string): ReleaseManifest {
  const files = filesUnder(dir)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    .map(path => {
      const data = readFileSync(join(dir, path))
      return { path, bytes: data.length, sha256: sha256(data) }
    })
  return { id: sha256(JSON.stringify(files)), files }
}

/** One entry of a store's history: a release made current by publishing it, or by rolling back to it from `from`. */
export type ReleaseRecord =
  | { readonly action: 'publish'; readonly id: string; readonly at: string }
  | { readonly action: 'rollback'; readonly id: string; readonly from: string; readonly at: string }

const short = (id: string) => id.slice(0, 12)
const historyFile = (store: string) => join(store, 'history.json')
const readHistory = (store: string): ReleaseRecord[] =>
  existsSync(historyFile(store)) ? (JSON.parse(readFileSync(historyFile(store), 'utf8')) as ReleaseRecord[]) : []

/** The id of the store's current release, or undefined before the first publish. */
export function currentRelease(store: string): string | undefined {
  const file = join(store, 'current')
  return existsSync(file) ? readFileSync(file, 'utf8').trim() : undefined
}

/** Records `record` and makes its release current; the pointer is replaced in one rename, so a reader sees one or the other. */
function makeCurrent(store: string, record: ReleaseRecord): ReleaseRecord {
  writeFileSync(historyFile(store), `${JSON.stringify([...readHistory(store), record], null, 2)}\n`)
  writeFileSync(join(store, 'current.next'), `${record.id}\n`)
  renameSync(join(store, 'current.next'), join(store, 'current'))
  return record
}

/** Copies the build into the store under its id, unless a release of that id is already there, and makes it current. */
export function publishRelease(buildDir: string, store: string, at: string): ReleaseRecord {
  const { id } = releaseManifest(buildDir)
  const target = join(store, 'releases', id)
  if (!existsSync(target)) {
    // Copied beside the target, then renamed into place, so a release folder is never seen half-written.
    mkdirSync(join(store, 'releases'), { recursive: true })
    rmSync(`${target}.partial`, { recursive: true, force: true })
    cpSync(buildDir, `${target}.partial`, { recursive: true })
    renameSync(`${target}.partial`, target)
  }
  return makeCurrent(store, { action: 'publish', id, at })
}

/**
 * Makes `to`, or else the release that was current before the current one, current again. Nothing is copied or rebuilt:
 * every release is still in the store as it was published. Throws, changing nothing, when there is no such release.
 */
export function rollBack(store: string, at: string, to?: string): ReleaseRecord {
  const from = currentRelease(store)
  if (!from) throw new Error(`No release is current in ${store}`)
  const id = to ?? readHistory(store).findLast(record => record.id !== from)?.id
  if (!id) throw new Error(`No earlier release to roll back to: ${short(from)} is the only one published to ${store}`)
  if (id === from) throw new Error(`Release ${short(id)} is already current`)
  if (!existsSync(join(store, 'releases', id))) throw new Error(`No published release ${short(id)} in ${store}`)
  return makeCurrent(store, { action: 'rollback', id, from, at })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      'dry-run': { type: 'boolean' },
      out: { type: 'string', default: 'release-manifest.json' },
      store: { type: 'string' },
      rollback: { type: 'boolean' },
      to: { type: 'string' },
    },
  })
  const dir = positionals[0] ?? 'build'
  const out = values.out
  if (!values['dry-run']) {
    console.error(NO_TARGET)
    process.exit(1)
  }
  if (values.rollback) {
    if (!values.store) {
      console.error('Usage: --rollback needs --store <dir>, the local release store (no host is configured).')
      process.exit(2)
    }
    try {
      const record = rollBack(values.store, new Date().toISOString(), values.to) as Extract<ReleaseRecord, { action: 'rollback' }>
      console.log(`Rolled back the local store ${values.store} from ${short(record.from)} to ${short(record.id)}; nothing was uploaded.`)
    } catch (error) {
      console.error((error as Error).message)
      process.exit(1)
    }
    process.exit(0)
  }
  const manifest = releaseManifest(dir)
  writeFileSync(out, `${JSON.stringify({ ...manifest, target: TARGET }, null, 2)}\n`)
  const bytes = manifest.files.reduce((sum, file) => sum + file.bytes, 0)
  console.log(`Dry run: release ${manifest.id.slice(0, 12)}, ${manifest.files.length} files, ${bytes} bytes, for the ${TARGET} target; nothing was uploaded. Manifest: ${out}`)
  if (values.store) {
    publishRelease(dir, values.store, new Date().toISOString())
    console.log(`Published release ${short(manifest.id)} to the local store ${values.store}.`)
  }
}
