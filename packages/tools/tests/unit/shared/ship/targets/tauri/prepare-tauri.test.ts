import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Effect, Either } from 'effect'
import { afterEach, describe, expect, it } from 'vitest'
import { defineShipConfig, type ShipConfig } from '#src/shared/ship/config/ship-config.ts'
import { prepareTauri } from '#src/shared/ship/targets/tauri/prepare-tauri.ts'
import { fakeProcessRunner, type RecordedRun } from '#src/shared/ship/testing/fake-process-runner.ts'
import type { RunResult } from '#src/shared/node/process-runner.ts'

// DIST spec §6.2: `automata ship prepare --target tauri` checks the build and the toolchain before writing anything,
// writes the Tauri project into `.automata/tauri/`, runs `tauri build` for the host OS and copies the bundles.

const config: ShipConfig = defineShipConfig({
  game: { id: 'cinder', title: 'Cinder', version: '1.2.0', entry: 'index.html' },
  runtime: { renderer: 'webgl2', orientation: 'landscape', inputs: ['keyboard'], pause_behavior: 'pause' },
  network: { connect: [] },
  content: { languages: ['en'], rating: 'everyone', descriptors: [] },
  tauri: { identifier: 'dev.example.cinder' },
})

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

/** A game folder with a web build in `dist/`, and `tauri` installed unless `withTauri` is false. */
function gameFolder(withTauri = true): { gameDir: string; distDir: string } {
  const gameDir = mkdtempSync(join(tmpdir(), 'af-tauri-'))
  roots.push(gameDir)
  const distDir = join(gameDir, 'dist')
  mkdirSync(join(distDir, 'assets'), { recursive: true })
  writeFileSync(
    join(distDir, 'index.html'),
    '<!doctype html><script type="module" src="./assets/a.js"></script>',
  )
  writeFileSync(join(distDir, 'assets/a.js'), 'console.log(1)')
  if (withTauri) {
    mkdirSync(join(gameDir, 'node_modules/.bin'), { recursive: true })
    // npm writes `tauri` on Linux and macOS and `tauri.cmd` on Windows.
    for (const bin of ['tauri', 'tauri.cmd'])
      writeFileSync(join(gameDir, 'node_modules/.bin', bin), '', { mode: 0o755 })
  }
  return { gameDir, distDir }
}

const ok: RunResult = { exitCode: 0, stdout: '', stderr: '' }

/** Answers like a machine with the toolchain; `tauri build` writes a .deb and an AppImage as Tauri does. */
function toolchain(overrides: { cargo?: number; webkit?: number; build?: number } = {}) {
  return (run: RecordedRun): RunResult => {
    if (run.command === 'cargo') return { ...ok, exitCode: overrides.cargo ?? 0 }
    if (run.command === 'pkg-config') return { ...ok, exitCode: overrides.webkit ?? 0 }
    if (/tauri(\.cmd)?$/.test(run.command)) {
      if ((overrides.build ?? 0) !== 0)
        return { exitCode: overrides.build ?? 1, stdout: '', stderr: 'linker failed' }
      const bundle = join(run.options.cwd as string, 'src-tauri/target/release/bundle')
      mkdirSync(join(bundle, 'deb'), { recursive: true })
      mkdirSync(join(bundle, 'appimage'), { recursive: true })
      writeFileSync(join(bundle, 'deb/Cinder_1.2.0_amd64.deb'), 'deb')
      writeFileSync(join(bundle, 'appimage/Cinder_1.2.0_amd64.AppImage'), 'appimage')
      return ok
    }
    return { ...ok, exitCode: 127 }
  }
}

const run = (
  input: Parameters<typeof prepareTauri>[0],
  reply: (run: RecordedRun) => RunResult = toolchain(),
) => {
  const fake = fakeProcessRunner(reply)
  const result = Effect.runSync(Effect.either(prepareTauri(input).pipe(Effect.provide(fake.layer))))
  return { result, runs: fake.runs }
}

describe('prepareTauri', () => {
  it('writes the project, runs tauri build for Linux, and copies each bundle under a stable name', () => {
    const { gameDir, distDir } = gameFolder()
    const { result, runs } = run({ distDir, gameDir, config, platform: 'linux' })
    expect(Either.isRight(result)).toBe(true)
    const project = join(gameDir, '.automata/tauri')
    expect(runs.map((each) => [each.command, ...each.args].join(' '))).toEqual([
      'cargo --version',
      'pkg-config --exists webkit2gtk-4.1',
      `${join(gameDir, 'node_modules/.bin/tauri')} build --bundles deb,appimage`,
    ])
    expect(runs[2]?.options).toMatchObject({ cwd: project, echo: true })
    const conf = JSON.parse(readFileSync(join(project, 'src-tauri/tauri.conf.json'), 'utf8'))
    expect(conf.build.frontendDist).toBe('../../../dist')
    expect(readFileSync(join(project, 'src-tauri/icons/icon.png')).subarray(1, 4).toString()).toBe('PNG')
    const out = join(gameDir, 'dist-tauri')
    expect(Either.isRight(result) && result.right.bundles).toEqual([
      join(out, 'cinder-1.2.0-linux-appimage.AppImage'),
      join(out, 'cinder-1.2.0-linux-deb.deb'),
    ])
    expect(readFileSync(join(out, 'cinder-1.2.0-linux-deb.deb'), 'utf8')).toBe('deb')
  })

  it("uses the game's own icon when the config names one", () => {
    const { gameDir, distDir } = gameFolder()
    writeFileSync(join(gameDir, 'icon.png'), 'my icon')
    const { result } = run({
      distDir,
      gameDir,
      config: { ...config, tauri: { identifier: 'dev.a.b', icon: 'icon.png' } },
      platform: 'linux',
    })
    expect(Either.isRight(result)).toBe(true)
    expect(readFileSync(join(gameDir, '.automata/tauri/src-tauri/icons/icon.png'), 'utf8')).toBe('my icon')
  })

  it.each([
    ['cargo', { cargo: 127 }, 'cargo'],
    ['WebKitGTK', { webkit: 1 }, 'webkit2gtk-4.1'],
  ] as const)(
    'stops before writing anything when %s is missing, saying what to install',
    (_what, overrides, missing) => {
      const { gameDir, distDir } = gameFolder()
      const { result, runs } = run({ distDir, gameDir, config, platform: 'linux' }, toolchain(overrides))
      expect(Either.isLeft(result) && result.left).toMatchObject({ _tag: 'TauriToolchainMissing', missing })
      expect(runs.some((each) => /tauri(\.cmd)?$/.test(each.command))).toBe(false)
      expect(existsSync(join(gameDir, '.automata'))).toBe(false)
    },
  )

  it('stops when the game has no tauri CLI installed, naming the package and version', () => {
    const { gameDir, distDir } = gameFolder(false)
    const { result } = run({ distDir, gameDir, config, platform: 'linux', pathEnv: '' })
    expect(Either.isLeft(result) && result.left).toMatchObject({
      _tag: 'TauriToolchainMissing',
      missing: 'tauri',
    })
    expect(Either.isLeft(result) && result.left.message).toContain('@tauri-apps/cli@2.12.3')
  })

  it('stops on a refused check before running anything: no tauri section, a non-semver version, a tag mismatch', () => {
    const { gameDir, distDir } = gameFolder()
    const { tauri: _tauri, ...noSection } = config
    expect(run({ distDir, gameDir, config: noSection, platform: 'linux' }).result).toMatchObject({
      left: { _tag: 'TauriBuildInvalid' },
    })
    const badVersion = { ...config, game: { ...config.game, version: '1.2' } }
    const refused = run({ distDir, gameDir, config: badVersion, platform: 'linux' })
    expect(Either.isLeft(refused.result) && refused.result.left.message).toContain('not semver')
    expect(refused.runs).toEqual([])
    expect(run({ distDir, gameDir, config, tag: 'v9.9.9', platform: 'linux' }).result).toMatchObject({
      left: { _tag: 'VersionMismatch' },
    })
  })

  it("relays tauri build's failure with its exit code, and copies nothing", () => {
    const { gameDir, distDir } = gameFolder()
    const { result } = run({ distDir, gameDir, config, platform: 'linux' }, toolchain({ build: 101 }))
    expect(Either.isLeft(result) && result.left).toMatchObject({ _tag: 'TauriBuildFailed', exitCode: 101 })
    expect(existsSync(join(gameDir, 'dist-tauri'))).toBe(false)
  })

  it('asks for the bundles of the OS it runs on', () => {
    for (const [platform, bundles] of [
      ['darwin', 'dmg'],
      ['win32', 'nsis,msi'],
    ] as const) {
      const { gameDir, distDir } = gameFolder()
      const { runs } = run({ distDir, gameDir, config, platform })
      expect(runs.find((each) => /tauri(\.cmd)?$/.test(each.command))?.args).toEqual([
        'build',
        '--bundles',
        bundles,
      ])
      expect(runs.some((each) => each.command === 'pkg-config')).toBe(false)
    }
  })
})
