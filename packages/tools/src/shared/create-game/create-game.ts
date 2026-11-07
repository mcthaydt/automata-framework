import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { Data, Effect } from 'effect'
import type { TaggedErrorClass } from '../node/errors.ts'
import {
  adapterConditions,
  DIST_TARGETS,
  type DistTarget,
  parseTargets,
  targetDependencies,
  targetGitignore,
  targetReadme,
  targetScripts,
} from './create-game-targets.ts'

export interface CreateGameOptions {
  readonly targetDir: string
  readonly id: string
  readonly title: string
  readonly description?: string | undefined
  readonly author?: string | undefined
  /** The distribution targets to build for; default all four. */
  readonly targets?: readonly DistTarget[] | undefined
}

export interface CreateGameResult {
  readonly targetDir: string
  readonly id: string
  readonly title: string
  readonly createdFiles: readonly string[]
}

const CreateGameErrorBase: TaggedErrorClass<
  'CreateGameError',
  {
    readonly reason: 'target-directory-exists' | 'invalid-id' | 'invalid-targets' | 'write-failed'
    readonly message: string
  }
> = Data.TaggedError('CreateGameError')

export class CreateGameError extends CreateGameErrorBase {}

/** A game id, and a kit name for `automata add`: lowercase letters, digits and single hyphens, so never a path. */
export const ID_REGEX: RegExp = /^[a-z0-9]+(-[a-z0-9]+)*$/

const targetsOf = (options: CreateGameOptions): readonly DistTarget[] => options.targets ?? DIST_TARGETS

interface TemplateFile {
  readonly path: string
  readonly content: (options: CreateGameOptions) => string
}

/** The \`ship.config.ts\` sections only some targets read: itch.io's project, the desktop app's identifier. */
function shipTargetSections(options: CreateGameOptions): string {
  const targets = targetsOf(options)
  // Placeholders that pass ship's checks, so every build is green with no edits; the guides say to change
  // them before publishing.
  const itch = targets.includes('itch')
    ? `\n  itch: { project: 'your-itch-user/${options.id}', channel: 'html5' },`
    : ''
  const tauri = targets.includes('tauri') ? `\n  tauri: { identifier: 'dev.example.${options.id}' },` : ''
  return itch + tauri
}

const TEMPLATE_FILES: readonly TemplateFile[] = [
  { path: '.gitignore', content: (options) => targetGitignore(targetsOf(options)) },
  { path: 'README.md', content: (options) => targetReadme(options.title, targetsOf(options)) },
  {
    path: 'package.json',
    content: (options) =>
      JSON.stringify(
        {
          name: options.id,
          version: '0.1.0',
          private: true,
          type: 'module',
          scripts: {
            dev: 'vite',
            ...targetScripts(targetsOf(options)),
            typecheck: 'tsc -p .',
          },
          dependencies: {
            '@mcthaydt/automata': 'workspace:*',
            '@mcthaydt/automata-sim': 'workspace:*',
            'pixi.js': '8.22.0',
            svelte: '5.57.1',
            zod: '4.6.6',
            ...targetDependencies(targetsOf(options)).dependencies,
          },
          devDependencies: {
            '@mcthaydt/automata-tools': 'workspace:*',
            '@sveltejs/vite-plugin-svelte': '7.3.1',
            '@types/node': '24.19.1',
            typescript: '7.0.2',
            vite: '8.3.3',
            ...targetDependencies(targetsOf(options)).devDependencies,
          },
        },
        null,
        2,
      ) + '\n',
  },
  {
    path: 'ship.config.ts',
    content: (options) => `import { defineShipConfig } from '@mcthaydt/automata-tools'
import packageJson from './package.json' with { type: 'json' }

export default defineShipConfig({
  game: {
    id: '${options.id}',
    title: '${options.title}',
    version: packageJson.version,
    entry: 'index.html',${targetsOf(options).includes('ruken') ? "\n    sdk: '^0.0.0'," : ''}
  },
  runtime: {
    renderer: 'webgl2',
    orientation: 'any',
    inputs: ['touch', 'keyboard'],
    pause_behavior: 'pause',
  },
  network: { connect: [] },
  content: { languages: ['en'], rating: 'everyone', descriptors: [] },${shipTargetSections(options)}
})
`,
  },
  {
    path: 'vite.config.ts',
    content: (options) => `import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defaultClientConditions, defineConfig } from 'vite'

// Each build holds one target's host adapter (\`vite build --mode <target>\`), picked through the package condition;
// any other mode (plain \`vite\` while developing) gets the web adapter, the default.
const ADAPTER_CONDITIONS: Record<string, string> = {
${adapterConditions(targetsOf(options))}
}

export default defineConfig(({ mode }) => ({
  base: './',
  resolve: { conditions: [ADAPTER_CONDITIONS[mode] ?? 'automata-web', ...defaultClientConditions] },
  // The framework's screens are Svelte components, compiled with the game.
  plugins: [svelte()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Vite would inline an asset under 4 kB as a data: URL, which the game's loader fetches and Ruken's CSP
    // (connect-src 'self') refuses; a file from the game's own origin is what the CSP allows.
    assetsInlineLimit: 0,
  },
}))
`,
  },
  {
    path: 'tsconfig.json',
    content: () =>
      JSON.stringify(
        {
          compilerOptions: {
            target: 'ES2022',
            module: 'NodeNext',
            moduleResolution: 'NodeNext',
            strict: true,
            esModuleInterop: true,
            skipLibCheck: true,
            forceConsistentCasingInFileNames: true,
            allowImportingTsExtensions: true,
            resolveJsonModule: true,
            noEmit: true,
          },
          include: ['src/**/*.ts', 'ship.config.ts', 'vite.config.ts'],
        },
        null,
        2,
      ) + '\n',
  },
  {
    path: 'index.html',
    content: (options) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>${options.title}</title>
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    <main id="game"></main>
    <script type="module" src="./src/main.ts"></script>
  </body>
</html>
`,
  },
  {
    path: 'style.css',
    content: () => `html,
body {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background-color: #000;
  color: #fff;
  font-family: sans-serif;
}

#game {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
`,
  },
  {
    path: 'src/constants.ts',
    content: () => `// The numbers the game is built from.

/** The game's own pixels; the renderer scales them to the screen. */
export const SIZE = { width: 320, height: 180 }

/** How far the square moves each tick, in the game's pixels. */
export const SPEED = 2
`,
  },
  {
    path: 'src/components.ts',
    content: () => `import { defineComponent } from '@mcthaydt/automata-sim'

/** Where the square is, in the game's pixels. */
export const Square = defineComponent('square', { x: 'f32', y: 'f32' })
`,
  },
  {
    path: 'src/commands.ts',
    content: () => `import { defineCommand } from '@mcthaydt/automata-sim'
import { z } from 'zod'

const axis = z.number().int().min(-1).max(1).default(0)

/** What the player holds this tick: -1, 0 or 1 on each axis. */
export const Move = defineCommand('move', z.object({ x: axis, y: axis }))
`,
  },
  {
    path: 'src/systems.ts',
    content: () => `import { defineSystem } from '@mcthaydt/automata-sim'
import { Move } from './commands.ts'
import { Square } from './components.ts'
import { SPEED } from './constants.ts'

/** Moves the square by what the player holds. Only the sim changes the game, so a replay ends where play did. */
export const move = defineSystem('move', (ctx) => {
  for (const { payload } of ctx.commands.of(Move))
    for (const square of ctx.query(Square)) {
      const { x, y } = square.get(Square)
      square.set(Square, { x: x + payload.x * SPEED, y: y + payload.y * SPEED })
    }
})
`,
  },
  {
    path: 'src/state.ts',
    content: (options) => `import { definePlugin } from '@mcthaydt/automata-sim'
import { Move } from './commands.ts'
import { Square } from './components.ts'
import { move } from './systems.ts'

/** The game's sim: what it holds, what it hears and what runs each tick. */
export const plugin = definePlugin({ name: '${options.id}', defs: [Square, Move, move] })
`,
  },
  {
    path: 'src/views.ts',
    content: () => `import { rect } from '@mcthaydt/automata'
import { Square } from './components.ts'

/** How each thing in the sim is drawn. */
export const views = { [Square.id]: rect({ w: 8, h: 8, color: 0xffc825 }) }
`,
  },
  {
    path: 'src/main.ts',
    content: (
      options,
    ) => `// ${options.title}: a square the player moves, on the default title, play and pause screens.
// \`no-eval\` comes first: the web targets allow no eval.
import '@mcthaydt/automata/no-eval'
import { defineGame, keys, startGame } from '@mcthaydt/automata'
import { Move } from './commands.ts'
import { Square } from './components.ts'
import { SIZE } from './constants.ts'
import { plugin } from './state.ts'
import { views } from './views.ts'

export const game = defineGame({
  id: '${options.id}',
  title: '${options.title}',
  size: SIZE,
  sim: {
    plugins: [plugin],
    seed: 1,
    setup: (sim) => {
      sim.spawn([[Square, { x: SIZE.width / 2, y: SIZE.height / 2 }]])
    },
  },
  // Arrows or WASD, or the pad's D-pad; on a touch screen, buttons.
  input: keys(
    Move,
    {
      ArrowLeft: { x: -1 },
      KeyA: { x: -1 },
      ArrowRight: { x: 1 },
      KeyD: { x: 1 },
      ArrowUp: { y: -1 },
      KeyW: { y: -1 },
      ArrowDown: { y: 1 },
      KeyS: { y: 1 },
    },
    { pad: { 14: { x: -1 }, 15: { x: 1 }, 12: { y: -1 }, 13: { y: 1 } } },
  ),
  views,
})

startGame(game)
`,
  },
]

export function createGame(options: CreateGameOptions): Effect.Effect<CreateGameResult, CreateGameError> {
  return Effect.gen(function* () {
    if (!ID_REGEX.test(options.id)) {
      return yield* Effect.fail(
        new CreateGameError({
          reason: 'invalid-id',
          message: `"${options.id}" can't be a game id. Use lowercase letters, digits and hyphens, like my-game.`,
        }),
      )
    }

    if (options.targets !== undefined) {
      const checked = parseTargets(options.targets.join(','))
      if (!checked.ok)
        return yield* Effect.fail(
          new CreateGameError({ reason: 'invalid-targets', message: checked.message }),
        )
    }

    if (existsSync(options.targetDir)) {
      const existingFiles = readdirSync(options.targetDir)
      if (existingFiles.length > 0) {
        return yield* Effect.fail(
          new CreateGameError({
            reason: 'target-directory-exists',
            message: `${options.targetDir} already has files in it. Pick a new folder.`,
          }),
        )
      }
    }

    const createdFiles: string[] = []
    let createdTargetDir = false

    try {
      if (!existsSync(options.targetDir)) {
        mkdirSync(options.targetDir, { recursive: true })
        createdTargetDir = true
      }

      for (const tpl of TEMPLATE_FILES) {
        const fullPath = join(options.targetDir, tpl.path)
        const dir = dirname(fullPath)
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true })
        }
        writeFileSync(fullPath, tpl.content(options), 'utf8')
        createdFiles.push(tpl.path)
      }
    } catch (cause) {
      if (createdTargetDir) {
        try {
          rmSync(options.targetDir, { recursive: true, force: true })
        } catch {
          // ignore cleanup errors
        }
      }
      return yield* Effect.fail(
        new CreateGameError({
          reason: 'write-failed',
          message: `Couldn't write the game's files: ${cause instanceof Error ? cause.message : String(cause)}`,
        }),
      )
    }

    return {
      targetDir: options.targetDir,
      id: options.id,
      title: options.title,
      createdFiles,
    }
  })
}
