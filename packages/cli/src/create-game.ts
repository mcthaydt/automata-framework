import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { TaggedErrorClass } from '@mcthaydt/automata-node'
import { Data, Effect } from 'effect'

export interface CreateGameOptions {
  readonly targetDir: string
  readonly id: string
  readonly title: string
  readonly description?: string | undefined
  readonly author?: string | undefined
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
    readonly reason: 'target-directory-exists' | 'invalid-id' | 'write-failed'
    readonly message: string
  }
> = Data.TaggedError('CreateGameError')

export class CreateGameError extends CreateGameErrorBase {}

/** A game id, and a kit name for `automata add`: lowercase letters, digits and single hyphens, so never a path. */
export const ID_REGEX: RegExp = /^[a-z0-9]+(-[a-z0-9]+)*$/

interface TemplateFile {
  readonly path: string
  readonly content: (options: CreateGameOptions) => string
}

const TEMPLATE_FILES: readonly TemplateFile[] = [
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
            build: 'vite build',
            'prepare-ruken': 'automata-ship prepare',
            typecheck: 'tsc -p .',
          },
          dependencies: {
            '@mcthaydt/automata-sim': 'workspace:*',
            '@ruken/sdk': '^0.0.0',
            effect: '3.22.2',
            'pixi.js': '8.21.0',
            zod: '4.6.6',
          },
          devDependencies: {
            '@mcthaydt/automata-ship': 'workspace:*',
            '@types/node': '24.19.1',
            typescript: '7.0.2',
            vite: '8.3.3',
          },
        },
        null,
        2,
      ) + '\n',
  },
  {
    path: 'ship.config.ts',
    content: (options) => `import { defineShipConfig } from '@mcthaydt/automata-ship'
import packageJson from './package.json' with { type: 'json' }

export default defineShipConfig({
  game: {
    id: '${options.id}',
    title: '${options.title}',
    version: packageJson.version,
    entry: 'index.html',
    sdk: '^0.0.0',
  },
  runtime: {
    renderer: 'webgl2',
    orientation: 'any',
    inputs: ['touch', 'keyboard'],
    pause_behavior: 'pause',
  },
  network: { connect: [] },
  content: { languages: ['en'], rating: 'everyone', descriptors: [] },
})
`,
  },
  {
    path: 'vite.config.ts',
    content: () => `import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
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
    path: 'src/main.ts',
    content: (options) => `// ${options.title} - Main Entry Point
import { boot } from './boot.ts'

const root = document.querySelector<HTMLElement>('#game')
if (!root) throw new Error('#game element not found')

boot(root).catch((err) => {
  console.error('Failed to boot game', err)
})
`,
  },
  {
    path: 'src/boot.ts',
    content: () => `import { createGameApp } from './game.ts'

export async function boot(container: HTMLElement): Promise<void> {
  const app = createGameApp(container)
  await app.start()
}
`,
  },
  {
    path: 'src/game.ts',
    content: (options) => `import { createGameSim } from './sim/index.ts'

export interface GameApp {
  start(): Promise<void>
  stop(): Promise<void>
}

export function createGameApp(container: HTMLElement): GameApp {
  const _sim = createGameSim()
  return {
    async start() {
      container.textContent = '${options.title} running'
    },
    async stop() {
      container.textContent = ''
    },
  }
}
`,
  },
  {
    path: 'src/sim/sim.ts',
    content: () => `import { createSim } from '@mcthaydt/automata-sim'

export function createGameSim() {
  return createSim({
    plugins: [],
  })
}
`,
  },
  {
    path: 'src/sim/index.ts',
    content: () => `export { createGameSim } from './sim.ts'
`,
  },
]

export function createGame(options: CreateGameOptions): Effect.Effect<CreateGameResult, CreateGameError> {
  return Effect.gen(function* () {
    if (!ID_REGEX.test(options.id)) {
      return yield* Effect.fail(
        new CreateGameError({
          reason: 'invalid-id',
          message: `Invalid game id "${options.id}". ID must be lowercase alphanumeric with hyphens (e.g. my-game).`,
        }),
      )
    }

    if (existsSync(options.targetDir)) {
      const existingFiles = readdirSync(options.targetDir)
      if (existingFiles.length > 0) {
        return yield* Effect.fail(
          new CreateGameError({
            reason: 'target-directory-exists',
            message: `Target directory "${options.targetDir}" already exists and is not empty.`,
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
          message: `Failed to write template files: ${cause instanceof Error ? cause.message : String(cause)}`,
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
