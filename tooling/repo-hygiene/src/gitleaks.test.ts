import { execFileSync, spawn } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ensureGitleaks,
  ensureRepoGitleaks,
  GITLEAKS_VERSION,
  type GitleaksAsset,
  gitleaksAsset,
  verifiedDownload,
} from './gitleaks.ts'

// The secret scan runs a pinned gitleaks release binary, checked against the SHA-256 published with that
// release, the same way locally and in CI (QB.1). No network here: every download goes through an injected fetch.

const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex')
const bytesResponse = (bytes: Uint8Array) => async () => new Response(new Blob([new Uint8Array(bytes)]))

describe('gitleaksAsset', () => {
  it.each([
    ['linux', 'x64', 'linux_x64', '551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb'],
    ['linux', 'arm64', 'linux_arm64', 'e4a487ee7ccd7d3a7f7ec08657610aa3606637dab924210b3aee62570fb4b080'],
    ['darwin', 'x64', 'darwin_x64', 'dfe101a4db2255fc85120ac7f3d25e4342c3c20cf749f2c20a18081af1952709'],
    ['darwin', 'arm64', 'darwin_arm64', 'b40ab0ae55c505963e365f271a8d3846efbc170aa17f2607f13df610a9aeb6a5'],
  ])('%s %s downloads the %s release with its published SHA-256', (platform, arch, suffix, hash) => {
    const asset = gitleaksAsset(platform, arch)
    expect(asset.url).toBe(
      `https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}/gitleaks_${GITLEAKS_VERSION}_${suffix}.tar.gz`,
    )
    expect(asset.sha256).toBe(hash)
  })

  it('refuses a platform with no pinned release', () => {
    expect(() => gitleaksAsset('win32', 'x64')).toThrow(/no pinned gitleaks release for win32 x64/)
  })
})

describe('verifiedDownload', () => {
  const bytes = new TextEncoder().encode('a release tarball')

  it('returns the bytes when their SHA-256 matches', async () => {
    const got = await verifiedDownload('https://example.test/a', sha256(bytes), bytesResponse(bytes))
    expect(sha256(got)).toBe(sha256(bytes))
  })

  it('rejects bytes whose SHA-256 differs from the pinned one', async () => {
    const other = new TextEncoder().encode('something else')
    await expect(
      verifiedDownload('https://example.test/a', sha256(bytes), bytesResponse(other)),
    ).rejects.toThrow(/SHA-256 mismatch/)
  })

  it('rejects a failed download', async () => {
    const notFound = async () => new Response('missing', { status: 404 })
    await expect(verifiedDownload('https://example.test/a', sha256(bytes), notFound)).rejects.toThrow(/404/)
  })
})

const scratches: string[] = []
afterEach(() => {
  for (const dir of scratches.splice(0)) rmSync(dir, { recursive: true, force: true })
})

function scratch(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix))
  scratches.push(dir)
  return dir
}

/**
 * A stand-in release: a tarball whose `gitleaks` is a shell script that prints `gitleaks-ok` on its LAST line,
 * after `padding` random bytes of comment, so only a whole binary prints it and extracting one takes a while.
 */
function fakeRelease(padding: number): { asset: GitleaksAsset; bytes: Uint8Array; path: string } {
  const dir = scratch('gitleaks-release-')
  const script = `#!/bin/sh\n# ${randomBytes(padding).toString('base64')}\necho gitleaks-ok\n`
  writeFileSync(join(dir, 'gitleaks'), script, { mode: 0o755 })
  const path = join(dir, 'release.tar.gz')
  execFileSync('tar', ['-czf', path, '-C', dir, 'gitleaks'])
  const bytes = new Uint8Array(readFileSync(path))
  return { asset: { url: 'https://example.test/gitleaks.tar.gz', sha256: sha256(bytes) }, bytes, path }
}

const runs = (binary: string): string => execFileSync(binary, { encoding: 'utf8' })

// A child that loads the module, waits for the shared start time, installs into a cold cache with a fetch that
// serves the stand-in release, then runs the binary it got back.
const INSTALL_AND_RUN = `
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
const [moduleUrl, cacheDir, tarballPath, sha256, startAt] = process.argv.slice(1)
const { ensureGitleaks } = await import(moduleUrl)
const bytes = readFileSync(tarballPath)
await new Promise((resolve) => setTimeout(resolve, Number(startAt) - Date.now()))
const asset = { url: 'https://example.test/gitleaks.tar.gz', sha256 }
const binary = await ensureGitleaks({ cacheDir, asset, fetch: async () => new Response(bytes) })
process.stdout.write(execFileSync(binary, { encoding: 'utf8' }))
`

function installAndRun(args: string[]): Promise<{ code: number | null; output: string }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['--input-type=module', '-e', INSTALL_AND_RUN, ...args])
    let output = ''
    child.stdout.on('data', (chunk: Buffer) => (output += chunk.toString()))
    child.stderr.on('data', (chunk: Buffer) => (output += chunk.toString()))
    child.on('close', (code) => resolve({ code, output }))
  })
}

describe('ensureGitleaks', () => {
  it('installs a cold cache from the verified download', async () => {
    const release = fakeRelease(1000)
    const cacheDir = scratch('gitleaks-cache-')
    const binary = await ensureGitleaks({
      cacheDir,
      asset: release.asset,
      fetch: bytesResponse(release.bytes),
    })
    expect(binary).toBe(join(cacheDir, GITLEAKS_VERSION, 'gitleaks'))
    expect(runs(binary)).toBe('gitleaks-ok\n')
  })

  it('leaves no binary behind when an install fails partway, so the next call installs again', async () => {
    const release = fakeRelease(2_000_000)
    const cacheDir = scratch('gitleaks-cache-')
    // tar stops at the cut with an error, after writing part of `gitleaks`. Its "gzip: stdin: unexpected end of
    // file" in the test log is this case, on purpose.
    const cut = release.bytes.slice(0, release.bytes.length / 2)
    const cutAsset = { url: release.asset.url, sha256: sha256(cut) }
    await expect(ensureGitleaks({ cacheDir, asset: cutAsset, fetch: bytesResponse(cut) })).rejects.toThrow()
    const binary = await ensureGitleaks({
      cacheDir,
      asset: release.asset,
      fetch: bytesResponse(release.bytes),
    })
    expect(runs(binary)).toBe('gitleaks-ok\n')
  })

  // A cold cache is installed by every process that finds it empty: vitest runs gitleaks-rules.test.ts and
  // secret-scan.test.ts in separate workers, and both call ensureRepoGitleaks in their beforeAll. Within one process
  // the synchronous write, extract and chmod never interleave, so this case races separate processes, the later
  // ones starting while the first is extracting.
  it('gives each of several installs at once, in separate processes, a whole binary that runs', async () => {
    const release = fakeRelease(8_000_000)
    const cacheDir = scratch('gitleaks-cache-')
    const moduleUrl = new URL('./gitleaks.ts', import.meta.url).href
    const startAt = Date.now() + 1000
    const results = await Promise.all(
      [0, 1, 2, 3].map((index) =>
        installAndRun([
          moduleUrl,
          cacheDir,
          release.path,
          release.asset.sha256,
          String(startAt + index * 20),
        ]),
      ),
    )
    for (const result of results) expect(result).toEqual({ code: 0, output: 'gitleaks-ok\n' })
  }, 90_000)

  it('uses the cached binary without downloading', async () => {
    const cacheDir = mkdtempSync(join(tmpdir(), 'gitleaks-cache-'))
    const binary = join(cacheDir, GITLEAKS_VERSION, 'gitleaks')
    mkdirSync(join(cacheDir, GITLEAKS_VERSION))
    writeFileSync(binary, '')
    const noNetwork = async (): Promise<Response> => {
      throw new Error('downloaded')
    }
    await expect(
      ensureGitleaks({ cacheDir, asset: gitleaksAsset('linux', 'x64'), fetch: noNetwork }),
    ).resolves.toBe(binary)
  })
})

describe('ensureRepoGitleaks', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("uses the repository's cache, <root>/node_modules/.cache/gitleaks, as pnpm secrets does", async () => {
    const root = mkdtempSync(join(tmpdir(), 'gitleaks-root-'))
    const binary = join(root, 'node_modules/.cache/gitleaks', GITLEAKS_VERSION, 'gitleaks')
    mkdirSync(join(binary, '..'), { recursive: true })
    writeFileSync(binary, '')
    // It downloads with the global fetch; a wrong cache path must fail here, not reach the network.
    vi.stubGlobal('fetch', async (): Promise<Response> => {
      throw new Error('downloaded')
    })
    await expect(ensureRepoGitleaks(root)).resolves.toBe(binary)
  })
})
