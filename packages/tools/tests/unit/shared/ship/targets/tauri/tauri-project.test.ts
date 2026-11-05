import { describe, expect, it } from 'vitest'
import { defineShipConfig, type ShipConfig } from '#src/shared/ship/config/ship-config.ts'
import { CRATE_PINS, tauriProjectFiles } from '#src/shared/ship/targets/tauri/tauri-project.ts'

const config: ShipConfig = defineShipConfig({
  game: { id: 'cinder', title: 'Cinder', version: '1.2.0', entry: 'index.html' },
  runtime: { renderer: 'webgl2', orientation: 'landscape', inputs: ['keyboard'], pause_behavior: 'pause' },
  network: { connect: [] },
  content: { languages: ['en'], rating: 'everyone', descriptors: [] },
  tauri: { identifier: 'dev.example.cinder' },
})
const settings = { identifier: 'dev.example.cinder' }

// DIST spec §6.2: the Tauri project ship writes into `.automata/tauri/src-tauri/` for each desktop build.
describe('tauriProjectFiles', () => {
  const files = tauriProjectFiles(config, settings, '../../../dist')

  it('writes the same files, byte for byte, for the same config', () => {
    expect(tauriProjectFiles(config, settings, '../../../dist')).toEqual(files)
    expect(Object.keys(files).sort()).toEqual([
      'Cargo.toml',
      'build.rs',
      'capabilities/default.json',
      'src/main.rs',
      'tauri.conf.json',
    ])
  })

  it("names the app from the game config, loads the web build, and sizes one window by the game's orientation", () => {
    const conf = JSON.parse(files['tauri.conf.json'] as string)
    expect(conf).toMatchObject({
      productName: 'Cinder',
      version: '1.2.0',
      identifier: 'dev.example.cinder',
      build: { frontendDist: '../../../dist' },
      app: { windows: [{ label: 'main', title: 'Cinder', width: 1280, height: 720, resizable: true }] },
      bundle: { active: true, icon: ['icons/icon.png'] },
    })
    expect(conf.app.security.csp).toContain("script-src 'self' 'wasm-unsafe-eval'")
    const portrait = tauriProjectFiles(
      { ...config, runtime: { ...config.runtime, orientation: 'portrait' } },
      settings,
      'dist',
    )
    expect(JSON.parse(portrait['tauri.conf.json'] as string).app.windows[0]).toMatchObject({
      width: 540,
      height: 960,
    })
  })

  it('pins every crate exactly, at versions released at least 14 days before they were chosen', () => {
    const cargo = files['Cargo.toml'] as string
    for (const [crate, version] of Object.entries(CRATE_PINS))
      expect(cargo).toContain(`${crate} = "=${version}"`)
    expect(cargo).toContain('name = "cinder"')
    expect(cargo).toContain('version = "1.2.0"')
    // A game id may start with a digit; a crate name may not.
    const digit = tauriProjectFiles({ ...config, game: { ...config.game, id: '9lives' } }, settings, 'dist')
    expect(digit['Cargo.toml']).toContain('name = "game-9lives"')
  })

  it('registers the store and process plugins, and grants the main window only what the adapter calls', () => {
    expect(files['src/main.rs']).toContain('tauri_plugin_store::Builder::default().build()')
    expect(files['src/main.rs']).toContain('tauri_plugin_process::init()')
    expect(JSON.parse(files['capabilities/default.json'] as string)).toEqual({
      identifier: 'default',
      windows: ['main'],
      permissions: ['core:default', 'store:default', 'process:allow-exit'],
    })
  })
})
