import { describe, expect, it } from 'vitest'
import { defineShipConfig, type ShipConfig } from '#src/shared/ship/config/ship-config.ts'
import {
  checkTauriEntry,
  checkTauriVersion,
  findEvalInCsp,
  tauriCsp,
  tauriSettings,
} from '#src/shared/ship/targets/tauri/tauri-checks.ts'

const config: ShipConfig = defineShipConfig({
  game: { id: 'cinder', title: 'Cinder', version: '1.2.0', entry: 'index.html' },
  runtime: { renderer: 'webgl2', orientation: 'landscape', inputs: ['keyboard'], pause_behavior: 'pause' },
  network: { connect: ['https://api.example.com'] },
  content: { languages: ['en'], rating: 'everyone', descriptors: [] },
  tauri: { identifier: 'dev.example.cinder' },
})

// DIST spec §6.2: the desktop build's checks, each naming what is wrong.
describe('the tauri checks', () => {
  it('reads the tauri section, and names a missing or invalid one', () => {
    expect(tauriSettings(config)).toEqual({ settings: { identifier: 'dev.example.cinder' }, problems: [] })
    const { tauri: _tauri, ...noSection } = config
    expect(tauriSettings(noSection).problems).toEqual([
      'ship.config.ts has no tauri section: add tauri: { identifier: "dev.example.your-game" }',
    ])
    expect(tauriSettings({ ...config, tauri: { identifier: 'cinder' } }).problems[0]).toMatch(
      /^tauri\.identifier: /,
    )
  })

  it('wants a semver game.version, which Tauri requires', () => {
    expect(checkTauriVersion('1.2.0')).toEqual([])
    expect(checkTauriVersion('1.2.0-beta.1+build.5')).toEqual([])
    expect(checkTauriVersion('1.2')).toEqual(['game.version "1.2" is not semver (major.minor.patch)'])
  })

  it('wants index.html at the build root as the entry', () => {
    expect(checkTauriEntry(['index.html', 'assets/a.js'], 'index.html')).toEqual([])
    expect(checkTauriEntry(['game.html'], 'game.html')).toEqual([
      'game.entry is "game.html": the desktop build loads index.html, so the entry must be index.html',
    ])
    expect(checkTauriEntry(['assets/a.js'], 'index.html')).toEqual([
      'index.html is missing from the build root',
    ])
  })

  it("writes a CSP with Ruken's no-eval shape, Tauri's IPC origins and the game's network origins", () => {
    const csp = tauriCsp(config)
    expect(csp).toContain("script-src 'self' 'wasm-unsafe-eval'")
    expect(csp).toContain('connect-src ipc: http://ipc.localhost https://api.example.com')
    expect(findEvalInCsp(csp)).toEqual([])
  })

  it("finds 'unsafe-eval' in a CSP, and not 'wasm-unsafe-eval'", () => {
    expect(findEvalInCsp("script-src 'self' 'unsafe-eval'")).toEqual([
      "the CSP allows 'unsafe-eval' (script-src): every web build runs without eval",
    ])
    expect(findEvalInCsp("script-src 'self' 'wasm-unsafe-eval'")).toEqual([])
  })
})
