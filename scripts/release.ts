// DX.12: a release of the site is the exact build CI tested, named by its content, so a release never changes once made
// and rolling back is choosing an earlier id (QB.4c). The deploy target is a placeholder until the Owner supplies a
// hosting account, a deploy credential and DNS for automata.ruken.com (decision 11); until then this script only plans
// a release (`--dry-run`) and refuses to publish, so nothing can reach a public host by mistake.
//
//   node --import tsx scripts/release.ts [build] --dry-run [--out release-manifest.json]
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

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

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2)
  const outAt = args.indexOf('--out')
  const out = outAt >= 0 ? args[outAt + 1]! : 'release-manifest.json'
  const dir = args.find((arg, index) => !arg.startsWith('--') && index !== outAt + 1) ?? 'build'
  if (!args.includes('--dry-run')) {
    console.error(NO_TARGET)
    process.exit(1)
  }
  const manifest = releaseManifest(dir)
  writeFileSync(out, `${JSON.stringify({ ...manifest, target: TARGET }, null, 2)}\n`)
  const bytes = manifest.files.reduce((sum, file) => sum + file.bytes, 0)
  console.log(`Dry run: release ${manifest.id.slice(0, 12)}, ${manifest.files.length} files, ${bytes} bytes, for the ${TARGET} target; nothing was uploaded. Manifest: ${out}`)
}
