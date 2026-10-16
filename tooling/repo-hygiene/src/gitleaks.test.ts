import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ensureGitleaks, GITLEAKS_VERSION, gitleaksAsset, verifiedDownload } from './gitleaks.ts'

// The secret scan runs a pinned gitleaks release binary, checked against the SHA-256 published with that
// release, the same way locally and in CI (QB.1). No network here: every download goes through an injected fetch.

const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex')
const bytesResponse = (bytes: Uint8Array) => async () => new Response(bytes)

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

describe('ensureGitleaks', () => {
  it('uses the cached binary without downloading', async () => {
    const cacheDir = mkdtempSync(join(tmpdir(), 'gitleaks-cache-'))
    const binary = join(cacheDir, GITLEAKS_VERSION, 'gitleaks')
    mkdirSync(join(cacheDir, GITLEAKS_VERSION))
    writeFileSync(binary, '')
    const noNetwork = async (): Promise<Response> => {
      throw new Error('downloaded')
    }
    await expect(
      ensureGitleaks({ cacheDir, platform: 'linux', arch: 'x64', fetch: noNetwork }),
    ).resolves.toBe(binary)
  })
})
