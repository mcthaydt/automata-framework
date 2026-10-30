import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { FilesLive } from '@mcthaydt/automata-node'
import { Effect, Either, Layer } from 'effect'
import { describe, expect, it } from 'vitest'
import { defineShipConfig } from '../config/ship-config.ts'
import { fakeProcessRunner } from '../testing/fake-process-runner.ts'
import { isLocalStack, type PublishBuildInput, publishBuild } from './publish-build.ts'

const config = defineShipConfig({
  game: { id: 'base-3d', title: 'Base 3D', version: '0.1.0', entry: 'index.html', sdk: '^0.0.0' },
  runtime: { renderer: 'webgl2', orientation: 'any', inputs: ['touch'], pause_behavior: 'pause' },
  network: { connect: [] },
  content: { languages: ['en'], rating: 'everyone', descriptors: [] },
})

/** A built game that contains @pixi/3d (one of ship's markers). */
function build3d(): string {
  const dir = mkdtempSync(join(tmpdir(), 'ship-publish-'))
  mkdirSync(join(dir, 'assets'))
  writeFileSync(join(dir, 'index.html'), '<script type="module" src="./assets/main.js"></script>')
  writeFileSync(join(dir, 'assets/main.js'), 'throw Error("View3D.screenToRay:degenerate")')
  return dir
}

function run(
  input: Omit<PublishBuildInput, 'distDir' | 'cwd' | 'config' | 'token' | 'activate' | 'cliPath'>,
) {
  const fake = fakeProcessRunner(() => ({
    exitCode: 0,
    stdout: 'Ready: http://g.localhost:5173/b/1/\n',
    stderr: '',
  }))
  const distDir = build3d()
  const effect = publishBuild({
    distDir,
    cwd: distDir,
    config,
    token: 't',
    activate: false,
    cliPath: '/ruken/cli.js',
    ...input,
  })
  const result = Effect.runSync(Effect.either(Effect.provide(effect, Layer.merge(FilesLive, fake.layer))))
  return { result, runs: fake.runs }
}

describe('isLocalStack', () => {
  it.each(['http://localhost:5173', 'http://127.0.0.1:8080', 'http://[::1]:5173', 'http://ruken.localhost'])(
    'takes %s',
    (api) => expect(isLocalStack(api)).toBe(true),
  )
  it.each(['https://ruken.app', 'http://192.168.1.4:5173', 'http://localhost.evil.com', 'not a url'])(
    'refuses %s',
    (api) => expect(isLocalStack(api)).toBe(false),
  )
})

describe('publishBuild (M3 spec §4.8, X-b)', () => {
  it('uploads a build with @pixi/3d to Ruken’s local stack when asked for a private publish', () => {
    const { result, runs } = run({ api: 'http://localhost:5173', private: true })
    expect(result).toEqual(Either.right({ url: 'http://g.localhost:5173/b/1/' }))
    expect(runs).toHaveLength(1)
  })

  it('refuses a private publish to anything but the local stack, before preparing or uploading', () => {
    const { result, runs } = run({ api: 'https://ruken.app', private: true })
    expect(Either.isLeft(result) && result.left._tag).toBe('PrivatePublishNotLocal')
    expect(runs).toEqual([])
  })

  it('refuses a public publish of a build with @pixi/3d, and uploads nothing', () => {
    const { result, runs } = run({ api: 'http://localhost:5173' })
    expect(Either.isLeft(result) && result.left._tag).toBe('Pixi3dInPublicBuild')
    expect(runs).toEqual([])
  })
})
