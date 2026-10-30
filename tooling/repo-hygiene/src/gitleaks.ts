// The pinned gitleaks binary for the secret scan (QB spec §4.1, QB.1). The same release binary runs locally
// and in CI, downloaded once into a cache and checked against the SHA-256 that gitleaks published with the
// release (gitleaks_8.30.1_checksums.txt), so a tampered or truncated download never runs.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { chmodSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
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
  readonly platform: string
  readonly arch: string
  readonly fetch: Fetch
}

/** The path of the pinned gitleaks binary, downloading and verifying it first if it is not cached. */
export async function ensureGitleaks(options: EnsureOptions): Promise<string> {
  const dir = join(options.cacheDir, GITLEAKS_VERSION)
  const binary = join(dir, 'gitleaks')
  if (existsSync(binary)) return binary
  const asset = gitleaksAsset(options.platform, options.arch)
  const tarball = await verifiedDownload(asset.url, asset.sha256, options.fetch)
  mkdirSync(dir, { recursive: true })
  const tarballPath = join(dir, 'gitleaks.tar.gz')
  writeFileSync(tarballPath, tarball)
  execFileSync('tar', ['-xzf', tarballPath, '-C', dir, 'gitleaks'])
  chmodSync(binary, 0o755)
  return binary
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
