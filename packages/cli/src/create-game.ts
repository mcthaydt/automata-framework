import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { TaggedErrorClass } from '@mcthaydt/automata-node'
import { Data, Effect } from 'effect'
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
  /** The distribution targets to build for (DIST spec §5.3); default all four (DIST-D9). */
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
  // Placeholders that pass ship's checks, so every build is green with no edits (DIST-h); the guides say to change
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
            '@mcthaydt/automata-host': 'workspace:*',
            '@mcthaydt/automata-sim': 'workspace:*',
            effect: '3.22.2',
            'pixi.js': '8.22.0',
            zod: '4.6.6',
            ...targetDependencies(targetsOf(options)).dependencies,
          },
          devDependencies: {
            '@mcthaydt/automata-ship': 'workspace:*',
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
    content: (options) => `import { defineShipConfig } from '@mcthaydt/automata-ship'
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
    content: (options) => `import { defaultClientConditions, defineConfig } from 'vite'

// Each build holds one target's host adapter (\`vite build --mode <target>\`), picked through the package condition;
// any other mode (plain \`vite\` while developing) gets the web adapter, the default.
const ADAPTER_CONDITIONS: Record<string, string> = {
${adapterConditions(targetsOf(options))}
}

export default defineConfig(({ mode }) => ({
  base: './',
  resolve: { conditions: [ADAPTER_CONDITIONS[mode] ?? 'automata-web', ...defaultClientConditions] },
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
  /* A double tap must not zoom, and a hold must not select the screen like text. */
  touch-action: manipulation;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
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
    content: (options) => `import { makeHosting } from '@mcthaydt/automata-host/target'
import { Effect, Exit, Scope } from 'effect'
import { createGameApp } from './game.ts'

// The host session lives as long as the page. Which host answers is the build's choice: \`vite build --mode <target>\`
// bundles that target's adapter (web, itch.io, Ruken or the desktop) and no other.
export async function boot(container: HTMLElement): Promise<void> {
  const session = Effect.runSync(Scope.make())
  const hosting = await Effect.runPromise(
    Scope.extend(makeHosting({ gameId: '${options.id}', wants: [], pauseBehavior: 'pause' }), session),
  )
  await Effect.runPromise(hosting.ready)
  const app = createGameApp(container, hosting.hostName)
  await app.start()
  window.addEventListener('pagehide', () => {
    void app.stop().then(() => Effect.runPromise(Scope.close(session, Exit.void)))
  })
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

export function createGameApp(container: HTMLElement, hostName: string): GameApp {
  const _sim = createGameSim()
  return {
    async start() {
      container.textContent = \`${options.title} running on \${hostName}\`
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
