import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Effect, Either } from 'effect'
import { afterEach, describe, expect, it } from 'vitest'
import type { RunResult } from '#src/shared/node/process-runner.ts'
import { defineShipConfig, type ShipConfig } from '#src/shared/ship/config/ship-config.ts'
import { publishDownloadsToItch } from '#src/shared/ship/targets/itch/publish-downloads-to-itch.ts'
import { fakeProcessRunner, type RecordedRun } from '#src/shared/ship/testing/fake-process-runner.ts'

// DIST spec §6.4: the desktop bundles go to itch.io as Downloadable files, one butler channel per OS.

const config: ShipConfig = defineShipConfig({
  game: { id: 'cinder', title: 'Cinder', version: '1.2.0', entry: 'index.html' },
  runtime: { renderer: 'webgl2', orientation: 'landscape', inputs: ['keyboard'], pause_behavior: 'pause' },
  network: { connect: [] },
  content: { languages: ['en'], rating: 'everyone', descriptors: [] },
  itch: { project: 'me/cinder', downloads: { mac: 'osx' } },
  tauri: { identifier: 'dev.example.cinder' },
})

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

/** A game folder whose `dist-tauri/` holds the named bundles. */
function withBundles(names: readonly string[]): string {
  const gameDir = mkdtempSync(join(tmpdir(), 'af-downloads-'))
  roots.push(gameDir)
  mkdirSync(join(gameDir, 'dist-tauri'))
  for (const name of names) writeFileSync(join(gameDir, 'dist-tauri', name), name)
  return gameDir
}

const ok: RunResult = { exitCode: 0, stdout: '', stderr: '' }

function publish(gameDir: string, reply: (run: RecordedRun) => RunResult = () => ok, overrides = {}) {
  const fake = fakeProcessRunner(reply)
  const input = { gameDir, config, apiKey: 'key', butlerPath: '/usr/bin/butler', ...overrides }
  const result = Effect.runSync(Effect.either(publishDownloadsToItch(input).pipe(Effect.provide(fake.layer))))
  return { result, runs: fake.runs }
}

describe('publishDownloadsToItch', () => {
  it("pushes one bundle per OS to its channel, each staged alone, with the game's version", () => {
    const gameDir = withBundles([
      'cinder-1.2.0-linux-appimage.AppImage',
      'cinder-1.2.0-linux-deb.deb',
      'cinder-1.2.0-macos-dmg.dmg',
      'cinder-1.1.0-macos-dmg.dmg',
    ])
    const { result, runs } = publish(gameDir)
    expect(Either.isRight(result) && result.right.pushed).toEqual(['linux', 'osx'])
    expect(runs.map((run) => run.args)).toEqual([
      [
        'push',
        join(gameDir, 'dist-tauri/.itch/linux'),
        'me/cinder:linux',
        '--userversion',
        '1.2.0',
        '--if-changed',
      ],
      [
        'push',
        join(gameDir, 'dist-tauri/.itch/osx'),
        'me/cinder:osx',
        '--userversion',
        '1.2.0',
        '--if-changed',
      ],
    ])
    expect(runs[0]?.options.env).toEqual({ BUTLER_API_KEY: 'key' })
    expect(readdirSync(join(gameDir, 'dist-tauri/.itch/linux'))).toEqual([
      'cinder-1.2.0-linux-appimage.AppImage',
    ])
    expect(readdirSync(join(gameDir, 'dist-tauri/.itch/osx'))).toEqual(['cinder-1.2.0-macos-dmg.dmg'])
  })

  it('fails before any process when no bundle of this version is there, naming prepare --target tauri', () => {
    const gameDir = withBundles(['cinder-1.1.0-linux-appimage.AppImage'])
    const { result, runs } = publish(gameDir)
    expect(Either.isLeft(result) && result.left).toMatchObject({ _tag: 'ItchDownloadsMissing' })
    expect(Either.isLeft(result) && result.left.message).toContain('automata ship prepare --target tauri')
    expect(runs).toEqual([])
  })

  it('fails before any process without the itch section, the key or butler', () => {
    const gameDir = withBundles(['cinder-1.2.0-linux-appimage.AppImage'])
    const { itch: _itch, ...noItch } = config
    for (const [overrides, setting] of [
      [{ config: noItch }, 'itch'],
      [{ apiKey: undefined }, 'BUTLER_API_KEY'],
      [{ butlerPath: undefined }, 'butler'],
    ] as const) {
      const { result, runs } = publish(gameDir, () => ok, overrides)
      expect(Either.isLeft(result) && result.left).toMatchObject({ _tag: 'ItchSettingMissing', setting })
      expect(runs).toEqual([])
    }
    expect(existsSync(join(gameDir, 'dist-tauri/.itch'))).toBe(false)
  })

  it("relays butler's exit code and pushes nothing after it", () => {
    const gameDir = withBundles(['cinder-1.2.0-linux-appimage.AppImage', 'cinder-1.2.0-windows-nsis.exe'])
    const { result, runs } = publish(gameDir, () => ({ ...ok, exitCode: 2 }))
    expect(Either.isLeft(result) && result.left).toMatchObject({ _tag: 'ButlerFailed', exitCode: 2 })
    expect(runs).toHaveLength(1)
  })
})
