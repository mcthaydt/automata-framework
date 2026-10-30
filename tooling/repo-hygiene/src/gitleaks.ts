// The pinned gitleaks binary for the secret scan (QB spec §4.1, QB.1). The same release binary runs locally
// and in CI, downloaded once into a cache and checked against the SHA-256 that gitleaks published with the
// release (gitleaks_8.30.1_checksums.txt), so a tampered or truncated download never runs.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export const GITLEAKS_VERSION = '8.30.1'

/** `<platform>_<arch>` (gitleaks' asset names) -> SHA-256 from the release's checksums file. */
const RELEASE_SHA256: Readonly<Record<string, string>> = {
  linux_x64: '551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb',
  linux_arm64: 'e4a487ee7ccd7d3a7f7ec08657610aa3606637dab924210b3aee62570fb4b080',
  darwin_x64: 'dfe101a4db2255fc85120ac7f3d25e4342c3c20cf749f2c20a18081af1952709',
  darwin_arm64: 'b40ab0ae55c505963e365f271a8d3846efbc170aa17f2607f13df610a9aeb6a5',
}

export type Fetch = (url: string) => Promise<Response>

export interface GitleaksAsset {
  readonly url: string
  readonly sha256: string
}

/** The release tarball for Node's `process.platform` and `process.arch`. */
export function gitleaksAsset(platform: string, arch: string): GitleaksAsset {
  const suffix = `${platform}_${arch}`
  const sha256 = RELEASE_SHA256[suffix]
  if (sha256 === undefined) throw new Error(`no pinned gitleaks release for ${platform} ${arch}`)
  const base = `https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}`
  return { url: `${base}/gitleaks_${GITLEAKS_VERSION}_${suffix}.tar.gz`, sha256 }
}

/** Downloads `url` and returns its bytes only if their SHA-256 is `sha256`. */
export async function verifiedDownload(url: string, sha256: string, fetch: Fetch): Promise<Uint8Array> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`download failed: ${url} answered ${response.status}`)
  const bytes = new Uint8Array(await response.arrayBuffer())
  const actual = createHash('sha256').update(bytes).digest('hex')
  if (actual !== sha256) throw new Error(`SHA-256 mismatch for ${url}: expected ${sha256}, got ${actual}`)
  return bytes
}

export interface EnsureOptions {
  /** Holds one folder per version, `<cacheDir>/<version>/gitleaks`. */
  readonly cacheDir: string
  /** The release tarball to install when the cache has no binary: `gitleaksAsset` for this machine. */
  readonly asset: GitleaksAsset
  readonly fetch: Fetch
}

/** The path of the pinned gitleaks binary, downloading and verifying it first if it is not cached. */
export async function ensureGitleaks(options: EnsureOptions): Promise<string> {
  const dir = join(options.cacheDir, GITLEAKS_VERSION)
  const binary = join(dir, 'gitleaks')
  if (existsSync(binary)) return binary
  const tarball = await verifiedDownload(options.asset.url, options.asset.sha256, options.fetch)
  installBinary(dir, tarball)
  return binary
}

/**
 * Unpacks the tarball's `gitleaks` to `<dir>/gitleaks` so that the path holds either nothing or a whole,
 * executable binary, never one being written.
 *
 * Several processes can install the same cold cache at once (vitest runs two test files that need the binary in
 * separate workers, and `ensureGitleaks` only checks that the binary exists), and an install can stop partway
 * (tar failing, or the process killed). So each install writes and extracts in a folder of its own, beside the
 * binary so the two share a filesystem, and then renames the finished binary into place, which is atomic. When
 * two installs both finish, the later rename swaps in the same bytes; a process already running the earlier
 * binary keeps its file. Nothing executes or extracts a file another process is still writing (2026-10-30: a
 * shared tarball path gave "gzip: stdin: unexpected end of file", and a shared binary path ETXTBSY).
 */
function installBinary(dir: string, tarball: Uint8Array): void {
  mkdirSync(dir, { recursive: true })
  const staging = mkdtempSync(join(dir, '.install-'))
  try {
    const tarballPath = join(staging, 'gitleaks.tar.gz')
    writeFileSync(tarballPath, tarball)
    execFileSync('tar', ['-xzf', tarballPath, '-C', staging, 'gitleaks'])
    chmodSync(join(staging, 'gitleaks'), 0o755)
    renameSync(join(staging, 'gitleaks'), join(dir, 'gitleaks'))
  } finally {
    rmSync(staging, { recursive: true, force: true })
  }
}

/**
 * The pinned binary in the repository's own cache, `<root>/node_modules/.cache/gitleaks`, downloaded with the
 * global `fetch` the first time. `pnpm secrets` and the tests that run gitleaks share it.
 */
export async function ensureRepoGitleaks(root: string): Promise<string> {
  return ensureGitleaks({
    cacheDir: join(root, 'node_modules/.cache/gitleaks'),
    asset: gitleaksAsset(process.platform, process.arch),
    fetch: (url) => fetch(url),
  })
}

/**
 * The arguments of the history scan: the repository's config, and every commit the checkout's HEAD reaches.
 * Not gitleaks' default, which is every ref (`--all`): CI's full-history checkout also fetches every branch on
 * origin, so a finding on one lane's unmerged branch failed every other pull request (2026-10-30). A branch is
 * scanned when its own pull request runs, as HEAD of that pull request's merge commit, and main when it is pushed.
 */
export function historyScanArgs(root: string, config: string): string[] {
  return ['--config', config, '--log-opts=--full-history HEAD', root]
}
