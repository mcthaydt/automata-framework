import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { FilesLive } from '@mcthaydt/automata-node'
import { Effect, Either, Layer } from 'effect'
import { describe, expect, it } from 'vitest'
import { defineShipConfig } from '../config/ship-config.ts'
import { rukenToml } from '../manifest/ruken-toml.ts'
import { fakeProcessRunner, type RecordedRun } from '../testing/fake-process-runner.ts'
import { type DeployDevInput, deployDev } from './deploy-dev.ts'

const config = defineShipConfig({
  game: { id: 'placeholder', title: 'Placeholder', version: '0.1.0', entry: 'index.html', sdk: '^0.0.0' },
  runtime: { renderer: 'canvas2d', orientation: 'any', inputs: ['touch'], pause_behavior: 'pause' },
  network: { connect: ['https://api.example.com'] },
  content: { languages: ['en'], rating: 'everyone', descriptors: [] },
})

function preparedDist(): string {
  const dir = mkdtempSync(join(tmpdir(), 'ship-deploy-dev-'))
  mkdirSync(join(dir, 'assets'))
  writeFileSync(join(dir, 'index.html'), '<title>Placeholder</title>')
  writeFileSync(join(dir, 'assets/main.js'), '')
  writeFileSync(join(dir, 'ruken.toml'), rukenToml(config))
  return dir
}

const input = (distDir: string): DeployDevInput => ({
  distDir,
  commit: { sha: 'abcdef0123456789abcdef0123456789abcdef01', time: new Date('2026-10-11T12:05:00Z') },
  branch: 'main',
  tag: undefined,
  target: 'deploy@af-dev.example.org',
  siteUrl: 'https://af-dev.example.org',
  activate: true,
})

/** Stands in for tar and ssh: tar records what it was asked to pack and writes a fake archive. */
function fakeTools(sshExit = 0) {
  const packed: { buildJson?: unknown; headersJson?: unknown; client?: string } = {}
  const fake = fakeProcessRunner((run: RecordedRun) => {
    if (run.command === 'tar') {
      const out = run.args[1] ?? ''
      const staging = run.args[3] ?? ''
      packed.buildJson = JSON.parse(readFileSync(join(staging, 'build.json'), 'utf8'))
      packed.headersJson = JSON.parse(readFileSync(join(staging, 'headers.json'), 'utf8'))
      packed.client = readFileSync(join(staging, 'client/index.html'), 'utf8')
      writeFileSync(out, 'TARBALL')
      return { exitCode: 0, stdout: '', stderr: '' }
    }
    return { exitCode: sshExit, stdout: '', stderr: sshExit === 0 ? '' : 'build is already installed\n' }
  })
  return { fake, packed, layer: Layer.merge(fake.layer, FilesLive) }
}

describe('deployDev', () => {
  it("packs the build with its build.json and Ruken's headers and sends it to the host's deploy over ssh", () => {
    const { fake, packed, layer } = fakeTools()
    const result = Effect.runSync(Effect.provide(deployDev(input(preparedDist())), layer))

    expect(result).toEqual({
      buildId: '202610111205-abcdef0',
      url: 'https://af-dev.example.org/builds/202610111205-abcdef0/',
    })
    expect(packed.buildJson).toEqual({
      buildId: '202610111205-abcdef0',
      commit: 'abcdef0123456789abcdef0123456789abcdef01',
      tag: null,
      branch: 'main',
      version: '0.1.0',
    })
    const headers = packed.headersJson as { headers: Record<string, string>; entry: string }
    expect(headers.entry).toBe('index.html')
    expect(headers.headers['Content-Security-Policy']).toContain('connect-src')
    expect(headers.headers['Content-Security-Policy']).toContain('https://api.example.com')
    expect(headers.headers['Content-Security-Policy']).toContain('frame-ancestors https://af-dev.example.org')
    expect(packed.client).toBe('<title>Placeholder</title>')

    const ssh = fake.runs[1]
    expect(ssh?.command).toBe('ssh')
    expect(ssh?.args).toEqual(['-o', 'BatchMode=yes', 'deploy@af-dev.example.org', 'deploy --activate'])
    expect(new TextDecoder().decode(ssh?.options.stdin)).toBe('TARBALL')
  })

  it('uses only the given key and known-hosts files when set (CI keeps them out of ~/.ssh)', () => {
    const { fake, layer } = fakeTools()
    Effect.runSync(
      Effect.provide(
        deployDev({ ...input(preparedDist()), sshKeyFile: '/tmp/k/id', knownHostsFile: '/tmp/k/hosts' }),
        layer,
      ),
    )
    expect(fake.runs[1]?.args).toEqual([
      '-o',
      'BatchMode=yes',
      '-i',
      '/tmp/k/id',
      '-o',
      'IdentitiesOnly=yes',
      '-o',
      'UserKnownHostsFile=/tmp/k/hosts',
      'deploy@af-dev.example.org',
      'deploy --activate',
    ])
  })

  it('asks for a plain deploy when not activating', () => {
    const { fake, layer } = fakeTools()
    Effect.runSync(Effect.provide(deployDev({ ...input(preparedDist()), activate: false }), layer))
    expect(fake.runs[1]?.args.at(-1)).toBe('deploy')
  })

  it("fails with DeployFailed carrying the host's message when deploy refuses", () => {
    const { layer } = fakeTools(3)
    const result = Effect.runSync(Effect.either(Effect.provide(deployDev(input(preparedDist())), layer)))
    if (Either.isRight(result)) throw new Error('expected a failure')
    expect(result.left._tag).toBe('DeployFailed')
    expect(result.left.message).toContain('already installed')
  })

  it('fails before packing when the build has not been prepared (no ruken.toml)', () => {
    const dir = preparedDist()
    const { fake, layer } = fakeTools()
    const result = Effect.runSync(
      Effect.either(Effect.provide(deployDev({ ...input(dir), distDir: join(dir, 'assets') }), layer)),
    )
    if (Either.isRight(result)) throw new Error('expected a failure')
    expect(result.left._tag).toBe('FileError')
    expect(fake.runs).toEqual([])
  })
})
