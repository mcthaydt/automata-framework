import {
  adapterConditions,
  targetDependencies,
  targetGitignore,
  targetReadme,
  targetScripts,
} from './create-game-targets.ts'
import { frameworkSpec, type TemplateFile, type TemplateOptions, targetsOf } from './template-file.ts'

// The files every game has whatever it plays like: its package, the ship config, the build and type settings, and
// the page. They change with the targets chosen, not with the game.

/** The `ship.config.ts` sections only some targets read: itch.io's project, the desktop app's identifier. */
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

/**
 * What a coding agent reads first. The game is edited by a person in the Automata app and by an agent working on a
 * branch of the same repository, so this says where each may change things and how a change is handed back.
 */
function agentsGuide(title: string): string {
  return `# ${title}

A small game made with [Automata](https://automataframework.com). A person edits its content in the Automata app. You
may edit it too.

## What you may change

- \`content/\`: the game's content. Tuning, feel, audio, writing, sequences and levels live here as TOML. Read a file
  before you change it; each says what its fields mean.
- \`src/\`: the game's behaviour, as TypeScript.

Level files need care: \`content/levels/*.toml\` is made from the \`content/levels/*.af2d.json\` beside it each time
the person saves in the app, so a change to a level TOML alone is overwritten. Change the \`.af2d.json\` instead.
Never edit \`content/generated/\` or \`.automata/\`.

## How to hand a change back

Work on a branch named claude/<what-you-did> and open a pull request. Do not push to \`main\`.
The person says yes in the Automata app.
When the checks pass, the person sees "Play it", "Use this change" and "Not this one".

## Checks

Run \`pnpm check\` and \`pnpm test\` before you open the pull request.

## Will it play on a phone or tablet?

The person plays your change in the Automata app on a phone or tablet, with no computer. The app can't run:

- a package it does not carry (three.js, for one);
- a game made with a newer framework than the app has;
- the game's own \`.svelte\` files in \`src/\`;
- a \`vite.config.ts\` plugin other than \`svelte()\` and \`automataContent()\`.

Run \`pnpm exec automata check-player\` before you open the pull request. It says what to change. It checks against
the runtime of the tools version this game pins; the person's Review card checks against the app on their device.

Commit \`pnpm-lock.yaml\` after you install.
`
}

/** The project's files, written beside the game's code. */
export const PROJECT_FILES: readonly TemplateFile[] = [
  { path: '.gitignore', content: (options) => targetGitignore(targetsOf(options)) },
  { path: 'AGENTS.md', content: (options) => agentsGuide(options.title) },
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
            '@mcthaydt/automata-content': frameworkSpec(options),
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
    content: (options) => `import { automataContent } from '@mcthaydt/automata-content/vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defaultClientConditions, defineConfig } from 'vite'
import { contentConfig } from './src/content.config.ts'

// Each build holds one target's host adapter (\`vite build --mode <target>\`), picked through the package condition;
// any other mode (plain \`vite\` while developing) gets the web adapter, the default.
const ADAPTER_CONDITIONS: Record<string, string> = {
${adapterConditions(targetsOf(options))}
}

export default defineConfig(({ mode }) => ({
  base: './',
  resolve: { conditions: [ADAPTER_CONDITIONS[mode] ?? 'automata-web', ...defaultClientConditions] },
  // The framework's screens are Svelte components, compiled with the game. The content plugin compiles \`content/\`
  // (the level the editor writes) into \`virtual:automata/content\`, again on every save while \`pnpm dev\` runs.
  // What it is given is \`src/content.config.ts\`, a plain file the Automata app reads too.
  plugins: [svelte(), automataContent(contentConfig)],
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
    path: 'src/content.config.ts',
    content: () => `import type { CompileOptions } from '@mcthaydt/automata-content/compile'
import { level2dKinds } from '@mcthaydt/automata-content/level-2d'

// What the content compiler is given: the kinds of content this game has. Add a kind of your own here. Keep this
// file to plain imports like these two: the Automata app compiles it on a phone, where there is no Node or Vite.
export const contentConfig: CompileOptions = { schemas: level2dKinds() }
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
            // Node's globals, and \`import.meta.hot\` for src/main.ts (the restart in place while \`pnpm dev\` runs).
            types: ['node', 'vite/client'],
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
]
