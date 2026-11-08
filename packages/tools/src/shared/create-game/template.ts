import {
  adapterConditions,
  DEFAULT_TARGETS,
  type DistTarget,
  targetDependencies,
  targetGitignore,
  targetReadme,
  targetScripts,
} from './create-game-targets.ts'
import { toolsVersion } from './tools-version.ts'

// The files of a new game. One square the player moves, to show the shape every game has: the sim in
// `src/features/<name>/`, the code both the sim and the screen read in `src/shared/`, the wiring in `src/app/`, a test
// of the sim, and the scripts that check and test it.

export interface TemplateOptions {
  readonly id: string
  readonly title: string
  /** The distribution targets to build for; default web and itch.io. */
  readonly targets?: readonly DistTarget[] | undefined
  /**
   * Ask for `workspace:*` instead of the published version. Only for a game made inside this repository's workspace
   * (the repository's own tests); anywhere else the packages come from a registry.
   */
  readonly linkWorkspace?: boolean | undefined
}

const targetsOf = (options: TemplateOptions): readonly DistTarget[] => options.targets ?? DEFAULT_TARGETS

/** What the game asks for of each framework package: the version of the tools that made it (read once). */
const frameworkSpec = (options: TemplateOptions): string =>
  options.linkWorkspace === true ? 'workspace:*' : `^${toolsVersion()}`

export interface TemplateFile {
  readonly path: string
  readonly content: (options: TemplateOptions) => string
}

/** The \`ship.config.ts\` sections only some targets read: itch.io's project, the desktop app's identifier. */
function shipTargetSections(options: TemplateOptions): string {
  const targets = targetsOf(options)
  // Placeholders that pass ship's checks, so every build is green with no edits; the guides say to change
  // them before publishing.
  const itch = targets.includes('itch')
    ? `\n  itch: { project: 'your-itch-user/${options.id}', channel: 'html5' },`
    : ''
  const tauri = targets.includes('tauri') ? `\n  tauri: { identifier: 'dev.example.${options.id}' },` : ''
  return itch + tauri
}

export const TEMPLATE_FILES: readonly TemplateFile[] = [
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
            test: 'vitest run',
            check: 'automata check',
          },
          dependencies: {
            '@mcthaydt/automata': frameworkSpec(options),
            '@mcthaydt/automata-sim': frameworkSpec(options),
            'pixi.js': '8.22.0',
            svelte: '5.57.1',
            zod: '4.6.6',
            ...targetDependencies(targetsOf(options)).dependencies,
          },
          devDependencies: {
            '@mcthaydt/automata-tools': frameworkSpec(options),
            '@sveltejs/vite-plugin-svelte': '7.3.1',
            '@types/node': '24.19.1',
            typescript: '7.0.2',
            vite: '8.3.3',
            vitest: '5.0.3',
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
    inputs: ['touch', 'keyboard', 'gamepad'],
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
          include: ['src/**/*.ts', 'tests/**/*.ts', 'ship.config.ts', 'vite.config.ts'],
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
    path: 'src/shared/constants.ts',
    content:
      () => `// The numbers the game is built from. Both the sim and the screen read them, so they live here.

/** The game's own pixels; the renderer scales them to the screen. */
export const SIZE = { width: 320, height: 180 }

/** How far the square moves each tick, in the game's pixels. */
export const SPEED = 2
`,
  },
  {
    path: 'src/features/square/square.component.ts',
    content: () => `import { defineComponent } from '@mcthaydt/automata-sim'

/** Where the square is, in the game's pixels. */
export const Square = defineComponent('square', { x: 'f32', y: 'f32' })
`,
  },
  {
    path: 'src/features/square/move.command.ts',
    content: () => `import { defineCommand } from '@mcthaydt/automata-sim'
import { z } from 'zod'

const axis = z.number().int().min(-1).max(1).default(0)

/** What the player holds this tick: -1, 0 or 1 on each axis. */
export const Move = defineCommand('move', z.object({ x: axis, y: axis }))
`,
  },
  {
    path: 'src/features/square/move.system.ts',
    content: () => `import { defineSystem } from '@mcthaydt/automata-sim'
import { SPEED } from '../../shared/constants.ts'
import { Move } from './move.command.ts'
import { Square } from './square.component.ts'

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
    path: 'src/features/square/square.plugin.ts',
    content: (options) => `import { definePlugin } from '@mcthaydt/automata-sim'
import { Move } from './move.command.ts'
import { move } from './move.system.ts'
import { Square } from './square.component.ts'

/** The square's part of the sim: what it holds, what it hears and what runs each tick. */
export const squarePlugin = definePlugin({ name: '${options.id}', defs: [Square, Move, move] })
`,
  },
  {
    path: 'src/features/square/square.view.ts',
    content: () => `import { rect } from '@mcthaydt/automata'
import { Square } from './square.component.ts'

/** How the square is drawn: a yellow box, 8 pixels across. */
export const squareView = { [Square.id]: rect({ w: 8, h: 8, color: 0xffc825 }) }
`,
  },
  {
    path: 'src/app/game.ts',
    content: (options) => `import { defineGame, keys } from '@mcthaydt/automata'
import { SIZE } from '../shared/constants.ts'
import { Move } from '../features/square/move.command.ts'
import { Square } from '../features/square/square.component.ts'
import { squarePlugin } from '../features/square/square.plugin.ts'
import { squareView } from '../features/square/square.view.ts'

/** ${options.title}: a square the player moves, on the default title, play and pause screens. */
export const game = defineGame({
  id: '${options.id}',
  title: '${options.title}',
  size: SIZE,
  sim: {
    plugins: [squarePlugin],
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
  views: squareView,
})
`,
  },
  {
    path: 'src/main.ts',
    content:
      () => `// The page's entry: starts the game. \`no-eval\` comes first, because the web targets allow no eval.
import '@mcthaydt/automata/no-eval'
import { startGame } from '@mcthaydt/automata'
import { game } from './app/game.ts'

startGame(game)
`,
  },
  {
    path: 'tests/unit/square/square-move.test.ts',
    content: (options) => `import { createSim } from '@mcthaydt/automata-sim'
import { describe, expect, it } from 'vitest'
import { Move } from '../../../src/features/square/move.command.ts'
import { Square } from '../../../src/features/square/square.component.ts'
import { squarePlugin } from '../../../src/features/square/square.plugin.ts'
import { SPEED } from '../../../src/shared/constants.ts'

// The sim is plain code, so its test needs no browser: make a sim, send it commands, read what it holds.
async function squareAfter(moves: readonly { x?: number; y?: number }[]) {
  const sim = await createSim({ seed: 1, tickHz: 60, plugins: [squarePlugin] })
  sim.spawn([[Square, { x: 100, y: 50 }]])
  for (const payload of moves)
    sim.step([{ tick: sim.tick, source: 0, seq: sim.tick, type: Move.id, payload: { x: 0, y: 0, ...payload } }])
  const [square] = sim.query(Square)
  const result = { position: square?.get(Square), hash: sim.hash() }
  sim.dispose()
  return result
}

describe('${options.title}: the square', () => {
  it('moves one step in the direction the player holds', async () => {
    const { position } = await squareAfter([{ x: 1 }])
    expect(position).toEqual({ x: 100 + SPEED, y: 50 })
  })

  it('stays put when the player holds nothing', async () => {
    const { position } = await squareAfter([{}])
    expect(position).toEqual({ x: 100, y: 50 })
  })

  it('ends in the same state every time the same moves are played', async () => {
    const moves = [{ x: 1 }, { y: -1 }, { x: -1, y: 1 }]
    expect((await squareAfter(moves)).hash).toBe((await squareAfter(moves)).hash)
  })
})
`,
  },
]
