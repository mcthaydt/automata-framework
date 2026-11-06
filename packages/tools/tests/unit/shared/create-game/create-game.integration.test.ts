import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, symlinkSync } from 'node:fs'
import { join } from 'node:path'
import { Effect } from 'effect'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createGame } from '#src/shared/create-game/create-game.ts'
import { FilesLive } from '#src/shared/node/files.ts'
import { prepareBuild } from '#src/shared/ship/prepare/prepare-build.ts'
import { prepareItch } from '#src/shared/ship/targets/itch/prepare-itch.ts'
import { checkManifest } from '#src/shared/ship/targets/ruken/check-manifest.ts'

describe('createGame integration', () => {
  const tempDir = join(process.cwd(), 'scratch-integration-test')

  beforeEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true })
    }
    mkdirSync(tempDir, { recursive: true })
    // A scaffolded game depends on this package, which the games in the workspace get from node_modules; here the
    // scratch folder sits inside the package, so the link is made by hand.
    mkdirSync(join(tempDir, 'node_modules/@mcthaydt'), { recursive: true })
    symlinkSync(process.cwd(), join(tempDir, 'node_modules/@mcthaydt/automata-tools'), 'dir')
  })

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('scaffolds project that produces valid ruken.toml accepted by @ruken/manifest', async () => {
    const gameDir = join(tempDir, 'my-adventure')
    const result = await Effect.runPromise(
      createGame({
        targetDir: gameDir,
        id: 'my-adventure',
        title: 'My Adventure',
      }),
    )

    expect(result.id).toBe('my-adventure')
    expect(result.title).toBe('My Adventure')

    // Simulate vite build output in dist/
    const distDir = join(gameDir, 'dist')
    mkdirSync(distDir, { recursive: true })
    copyFileSync(join(gameDir, 'index.html'), join(distDir, 'index.html'))

    // Load ship.config.ts from scaffolded project
    const shipConfigModule = await import(join(gameDir, 'ship.config.ts'))
    const config = shipConfigModule.default

    expect(config.game.id).toBe('my-adventure')
    expect(config.game.title).toBe('My Adventure')

    // Run automata ship prepareBuild on the scaffolded project
    const prepareProgram = Effect.provide(
      prepareBuild({
        distDir,
        config,
      }),
      FilesLive,
    )

    const prepareResult = await Effect.runPromise(prepareProgram)
    expect(prepareResult.manifestPath).toBe(join(distDir, 'ruken.toml'))
    expect(existsSync(prepareResult.manifestPath)).toBe(true)

    // Validate the generated ruken.toml with Ruken's manifest validator
    const tomlContent = readFileSync(prepareResult.manifestPath, 'utf8')
    const manifest = await Effect.runPromise(checkManifest(tomlContent))
    expect(manifest.game.id).toBe('my-adventure')
    expect(manifest.game.title).toBe('My Adventure')
    expect(manifest.game.version).toBe('0.1.0')
    expect(manifest.runtime.renderer).toBe('webgl2')
  })

  it('scaffolds all four targets by default, and the itch.io packaging accepts the build as written (DIST-h)', async () => {
    const gameDir = join(tempDir, 'four-peers')
    await Effect.runPromise(createGame({ targetDir: gameDir, id: 'four-peers', title: 'Four Peers' }))
    const distDir = join(gameDir, 'dist')
    mkdirSync(distDir, { recursive: true })
    copyFileSync(join(gameDir, 'index.html'), join(distDir, 'index.html'))
    const config = (await import(join(gameDir, 'ship.config.ts'))).default

    expect(config.itch.project).toBe('your-itch-user/four-peers')
    expect(config.tauri.identifier).toBe('dev.example.four-peers')
    const { zipPath } = await Effect.runPromise(
      prepareItch({ distDir, config }).pipe(Effect.provide(FilesLive)),
    )
    expect(existsSync(zipPath)).toBe(true)
    // The Ruken build still writes a manifest Ruken's parser accepts, with the other targets' sections beside it.
    const { manifestPath } = await Effect.runPromise(
      prepareBuild({ distDir, config }).pipe(Effect.provide(FilesLive)),
    )
    const manifest = await Effect.runPromise(checkManifest(readFileSync(manifestPath, 'utf8')))
    expect(manifest.game.id).toBe('four-peers')
  })
})
