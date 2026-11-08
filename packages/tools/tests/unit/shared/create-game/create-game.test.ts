import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { Effect, Exit } from 'effect'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CreateGameError, createGame } from '#src/shared/create-game/create-game.ts'
import type { DistTarget } from '#src/shared/create-game/create-game-targets.ts'
import { tauriConfigSchema } from '#src/shared/ship/config/tauri-config.schema.ts'

describe('createGame', () => {
  const testDir = join(process.cwd(), 'scratch-test-game')

  beforeEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
  })

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
  })

  describe('id validation', () => {
    it.each(['MyGame', 'my game', 'my_game', 'my.game', 'game!', '', '-start-hyphen', 'end-hyphen-'])(
      'rejects invalid id: "%s"',
      async (invalidId) => {
        const exit = await Effect.runPromise(
          Effect.exit(
            createGame({
              targetDir: testDir,
              id: invalidId,
              title: 'Test Game',
            }),
          ),
        )

        expect(Exit.isFailure(exit)).toBe(true)
        if (Exit.isFailure(exit)) {
          if (exit.cause._tag === 'Fail') {
            const err = exit.cause.error
            expect(err).toBeInstanceOf(CreateGameError)
            expect(err.reason).toBe('invalid-id')
          } else {
            expect.unreachable('expected Fail cause')
          }
        }
      },
    )
  })

  describe('directory collision', () => {
    it('fails when target directory exists and is not empty', async () => {
      mkdirSync(testDir, { recursive: true })
      writeFileSync(join(testDir, 'existing.txt'), 'hello')

      const exit = await Effect.runPromise(
        Effect.exit(
          createGame({
            targetDir: testDir,
            id: 'test-game',
            title: 'Test Game',
          }),
        ),
      )

      expect(Exit.isFailure(exit)).toBe(true)
      if (Exit.isFailure(exit)) {
        if (exit.cause._tag === 'Fail') {
          const err = exit.cause.error
          expect(err).toBeInstanceOf(CreateGameError)
          expect(err.reason).toBe('target-directory-exists')
          expect(err.message).toBe(`${testDir} already has files in it. Pick a new folder.`)
        } else {
          expect.unreachable('expected Fail cause')
        }
      }
    })
  })

  describe('scaffolding', () => {
    it('creates all project template files and substitutes id and title', async () => {
      const result = await Effect.runPromise(
        createGame({
          targetDir: testDir,
          id: 'stellar-odyssey',
          title: 'Stellar Odyssey',
        }),
      )

      expect(result.id).toBe('stellar-odyssey')
      expect(result.title).toBe('Stellar Odyssey')
      expect(result.targetDir).toBe(testDir)
      expect(result.createdFiles.length).toBeGreaterThanOrEqual(10)

      // Verify files exist
      expect(existsSync(join(testDir, 'package.json'))).toBe(true)
      expect(existsSync(join(testDir, 'ship.config.ts'))).toBe(true)
      expect(existsSync(join(testDir, 'vite.config.ts'))).toBe(true)
      expect(existsSync(join(testDir, 'tsconfig.json'))).toBe(true)
      // The level the editor opens, its editor list and the game files Save writes from it.
      for (const file of [
        'content/editors.toml',
        'content/levels/start.af2d.json',
        'content/levels/start.toml',
        'content/project.toml',
        'content/world.toml',
      ])
        expect(result.createdFiles, file).toContain(file)
      expect(existsSync(join(testDir, 'index.html'))).toBe(true)
      expect(existsSync(join(testDir, 'style.css'))).toBe(true)
      // A double tap must not zoom and a hold must not select the screen like text.
      const style = readFileSync(join(testDir, 'style.css'), 'utf8')
      expect(style).toContain('touch-action: manipulation')
      expect(style).toContain('-webkit-user-select: none')
      // Laid out by feature (template.test.ts pins the whole list).
      expect(existsSync(join(testDir, 'src/features/square/square.plugin.ts'))).toBe(true)

      // Verify template substitutions
      const pkgJson = JSON.parse(readFileSync(join(testDir, 'package.json'), 'utf8'))
      expect(pkgJson.name).toBe('stellar-odyssey')

      const shipConfig = readFileSync(join(testDir, 'ship.config.ts'), 'utf8')
      expect(shipConfig).toContain("id: 'stellar-odyssey'")
      expect(shipConfig).toContain("title: 'Stellar Odyssey'")

      const indexHtml = readFileSync(join(testDir, 'index.html'), 'utf8')
      expect(indexHtml).toContain('<title>Stellar Odyssey</title>')

      // The game boots on the default screens, with the no-eval guard first, and its sim is named after it.
      const main = readFileSync(join(testDir, 'src/main.ts'), 'utf8')
      expect(main.indexOf("import '@automata/framework/no-eval'")).toBeLessThan(main.indexOf('startGame'))
      expect(main).toContain('startGame(game)')
      expect(readFileSync(join(testDir, 'src/app/game.ts'), 'utf8')).toContain("title: 'Stellar Odyssey'")
      expect(readFileSync(join(testDir, 'src/features/square/square.plugin.ts'), 'utf8')).toContain(
        "name: 'stellar-odyssey'",
      )

      // Every asset ships as a file: an inlined `data:` URL is refused by Ruken's CSP when fetched (DX.5a).
      const viteConfig = readFileSync(join(testDir, 'vite.config.ts'), 'utf8')
      expect(viteConfig).toContain('assetsInlineLimit: 0')
    })

    // A new game installs the versions AF is tested on, so every exact pin the scaffold writes must be a row of
    // docs/versions.md; a bump that moves the doc and the workspace but not the scaffold fails here.
    it('pins every exact dependency at a version recorded in docs/versions.md', async () => {
      await Effect.runPromise(createGame({ targetDir: testDir, id: 'pinned-game', title: 'Pinned Game' }))

      const versionsDoc = readFileSync(new URL('../../../../../../docs/versions.md', import.meta.url), 'utf8')
      const recorded = new Set(
        [...versionsDoc.matchAll(/^\|\s*`([^`]+)`\s*\|\s*([^|\s]+)\s*\|/gm)].map(
          (row) => `${row[1]}@${row[2]}`,
        ),
      )
      const pkgJson = JSON.parse(readFileSync(join(testDir, 'package.json'), 'utf8'))
      const exactPins = Object.entries<string>({ ...pkgJson.dependencies, ...pkgJson.devDependencies })
        .filter(([, version]) => /^\d+\.\d+\.\d+$/.test(version))
        .map(([name, version]) => `${name}@${version}`)

      expect(exactPins).toContain(`pixi.js@${pkgJson.dependencies['pixi.js']}`)
      expect(exactPins.filter((pin) => !recorded.has(pin))).toEqual([])
    })
  })
  // The targets (DIST spec §5.3, DIST-D9): a script, config section, dependency and ignore line per target chosen.
  describe('targets', () => {
    const generate = async (targets?: readonly DistTarget[], extra: { linkWorkspace?: boolean } = {}) => {
      await Effect.runPromise(
        createGame({
          targetDir: testDir,
          id: 'peer-game',
          title: 'Peer Game',
          ...(targets ? { targets } : {}),
          ...extra,
        }),
      )
      const read = (file: string) => readFileSync(join(testDir, file), 'utf8')
      const pkg = JSON.parse(read('package.json')) as {
        scripts: Record<string, string>
        dependencies: Record<string, string>
        devDependencies: Record<string, string>
      }
      return { read, pkg }
    }

    it('writes web and itch.io by default: a Vite build for each, ship for itch.io, no plain build', async () => {
      const { pkg } = await generate()
      expect(pkg.scripts).toMatchObject({
        'build:web': 'vite build --mode web',
        'prepare:web': 'automata ship prepare --target web',
        'build:itch': 'vite build --mode itch',
        'prepare:itch': 'automata ship prepare --target itch',
      })
      expect(Object.keys(pkg.scripts).filter((name) => /^(build|prepare):/.test(name))).toEqual([
        'build:web',
        'build:itch',
        'prepare:web',
        'prepare:itch',
      ])
      expect(pkg.scripts.build).toBeUndefined()
      expect(
        Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).filter((name) =>
          /tauri|ruken/.test(name),
        ),
      ).toEqual([])
    })

    it('writes all four for --targets web,itch,tauri,ruken, and still no Ruken SDK dependency', async () => {
      const { pkg } = await generate(['web', 'itch', 'tauri', 'ruken'])
      expect(pkg.scripts).toMatchObject({
        'build:ruken': 'vite build --mode ruken',
        'build:tauri': 'vite build --mode tauri',
        'prepare:ruken': 'automata ship prepare --target ruken',
        'prepare:tauri': 'automata ship prepare --target tauri',
      })
      expect(pkg.dependencies).toMatchObject({
        '@tauri-apps/api': '2.12.4',
        '@tauri-apps/plugin-store': '2.5.0',
        '@tauri-apps/plugin-process': '2.4.0',
      })
      expect(pkg.devDependencies['@tauri-apps/cli']).toBe('2.12.3')
      // The Ruken adapter is bundled in @automata/framework's ruken entry, so no target asks for the SDK (N2).
      expect(pkg.dependencies['@ruken/sdk']).toBeUndefined()
    })

    it("asks for the running tools' version of each framework package, not a workspace link (N1)", async () => {
      const { pkg } = await generate()
      const version = (
        JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as { version: string }
      ).version
      expect(pkg.dependencies['@automata/framework']).toBe(`^${version}`)
      expect(pkg.dependencies['@automata/sim']).toBe(`^${version}`)
      expect(pkg.devDependencies['@automata/tools']).toBe(`^${version}`)
    })

    it("links the workspace only when asked, for the repository's own tests", async () => {
      const { pkg } = await generate(undefined, { linkWorkspace: true })
      expect(pkg.dependencies['@automata/framework']).toBe('workspace:*')
      expect(pkg.dependencies['@automata/sim']).toBe('workspace:*')
      expect(pkg.devDependencies['@automata/tools']).toBe('workspace:*')
    })

    it('writes only what the web target needs for --targets web', async () => {
      const { pkg, read } = await generate(['web'])
      expect(Object.keys(pkg.scripts).filter((name) => /^(build|prepare)/.test(name))).toEqual([
        'build:web',
        'prepare:web',
      ])
      expect(Object.keys(pkg.dependencies).filter((name) => /tauri|ruken/.test(name))).toEqual([])
      expect(pkg.devDependencies['@tauri-apps/cli']).toBeUndefined()
      const shipConfig = read('ship.config.ts')
      expect(shipConfig).not.toContain('tauri:')
      expect(shipConfig).not.toContain('itch:')
      expect(shipConfig).not.toContain('sdk:')
      expect(read('.gitignore').split('\n')).toEqual(['node_modules/', 'dist/', 'content/generated/', ''])
    })

    it('gives the desktop target an identifier ship accepts, and ignores its generated project and bundles', async () => {
      const { read } = await generate(['tauri'])
      const identifier = /identifier: '([^']+)'/.exec(read('ship.config.ts'))?.[1]
      expect(identifier).toBe('dev.example.peer-game')
      expect(tauriConfigSchema.safeParse({ identifier }).success).toBe(true)
      expect(read('.gitignore')).toContain('.automata/\ndist-tauri/\n')
    })

    it('gives itch.io a placeholder project and ignores its zip, and a Ruken game its manifest SDK range', async () => {
      const { read } = await generate(['itch', 'ruken'])
      const shipConfig = read('ship.config.ts')
      expect(shipConfig).toContain("itch: { project: 'your-itch-user/peer-game', channel: 'html5' }")
      expect(shipConfig).toContain("sdk: '^0.0.0'")
      expect(read('.gitignore')).toContain('*-itch.zip\n')
    })

    it("picks each build's host adapter from its mode, the web adapter otherwise, and compiles the screens", async () => {
      const { read } = await generate(['itch', 'tauri'])
      const viteConfig = read('vite.config.ts')
      expect(viteConfig).toContain("web: 'automata-web'")
      expect(viteConfig).toContain("itch: 'automata-web'")
      expect(viteConfig).toContain("tauri: 'automata-tauri'")
      expect(viteConfig).not.toContain('automata-ruken')
      expect(viteConfig).toContain("ADAPTER_CONDITIONS[mode] ?? 'automata-web'")
      expect(viteConfig).toContain('...defaultClientConditions')
      expect(viteConfig).toContain(
        'plugins: [svelte(), automataContent({ schemas: [...level2dKinds(), controlsKind(), feelContent, audioContent] })]',
      )
    })

    it('has an editor script, and the game’s title for the editor to show, as the game itself does', async () => {
      const { read, pkg } = await generate()
      expect(pkg.scripts.editor).toBe('automata editor')
      expect((JSON.parse(read('package.json')) as { automata?: { title?: string } }).automata?.title).toBe(
        'Peer Game',
      )
    })

    it('tells a first-time maker how the editors, Play and Publish work, with no Save button to look for', async () => {
      const { read } = await generate()
      const readme = read('README.md')
      expect(readme).toContain('`pnpm editor`')
      expect(readme).toMatch(/saves? (as|when|each)/i)
      expect(readme).toContain('Play')
      expect(readme).toContain('Publish')
      expect(readme).not.toMatch(/press Save/i)
    })

    it("lists the chosen targets' commands in the README", async () => {
      const { read } = await generate(['web', 'tauri'])
      const readme = read('README.md')
      expect(readme).toContain('pnpm build:web && pnpm prepare:web')
      expect(readme).toContain('pnpm build:tauri && pnpm prepare:tauri')
      expect(readme).not.toContain('build:ruken')
    })
  })
})
