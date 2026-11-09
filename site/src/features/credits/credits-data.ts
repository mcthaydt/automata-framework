// The open-source work Automata is built on, for /credits. Written by hand and held to the workspace by
// tests/unit/credits/credits.test.ts: every `packages` name is in a manifest, and every outside package a manifest
// needs to run is thanked here. Licences and homes were read from each package's registry entry on 2026-11-08; a
// licence is the package's own and is shown as it states it. The DUEL palette's Lospec page states none and leaves its
// `author` field empty; only the submitter, Arilyn, is named, so that is all the page claims. `what` is one plain line
// for someone who has never opened a terminal. Ruken is a place a game is published, not a tool we thank here, so it is
// not listed.

export type CreditGroupId = 'game' | 'ship' | 'editors' | 'checks' | 'art'

export interface CreditGroup {
  readonly id: CreditGroupId
  readonly title: string
  readonly intro: string
}

export interface Credit {
  readonly name: string
  readonly what: string
  readonly licence: string
  readonly url: string
  readonly group: CreditGroupId
  /** The npm packages this entry thanks; empty for work that is not a package (photos). */
  readonly packages: readonly string[]
}

export const CREDIT_GROUPS: readonly CreditGroup[] = [
  { id: 'game', title: 'Draws and runs your game', intro: 'What is inside a game when a player opens it.' },
  {
    id: 'ship',
    title: 'Builds and ships your game',
    intro: 'What the command line uses to check a game and put it online.',
  },
  {
    id: 'editors',
    title: 'The editors and this website',
    intro: 'What the editors and these pages are made with.',
  },
  {
    id: 'checks',
    title: 'Keeps the work honest',
    intro: 'What tests, checks and publishes Automata itself.',
  },
  { id: 'art', title: 'Pictures, colours and type', intro: 'The photos, colours and fonts we did not make.' },
]

export const CREDITS: readonly Credit[] = [
  // Draws and runs your game
  {
    name: 'PixiJS',
    what: 'Draws everything you see, in 2D and in 3D. The 3D comes from its Pixi 3D add-on, still in beta.',
    licence: 'MIT',
    url: 'https://pixijs.com',
    group: 'game',
    packages: ['pixi.js', '@pixi/3d'],
  },
  {
    name: 'Klipp',
    what: 'Moves and aims the camera in 3D scenes, from the pmndrs collective.',
    licence: 'MIT',
    url: 'https://github.com/pmndrs/klipp',
    group: 'game',
    packages: ['@pmndrs/klipp'],
  },
  {
    name: 'Koota',
    what: 'Keeps track of every thing in the game and its data, also from pmndrs.',
    licence: 'ISC',
    url: 'https://github.com/pmndrs/koota',
    group: 'game',
    packages: ['koota'],
  },
  {
    name: 'Rapier',
    what: 'Physics: things fall, bump and slide the same way every time.',
    licence: 'Apache 2.0',
    url: 'https://rapier.rs',
    group: 'game',
    packages: ['@dimforge/rapier2d-deterministic-compat', '@dimforge/rapier3d-deterministic-compat'],
  },
  {
    name: 'Colyseus',
    what: 'Runs online rooms, so friends can play the same game together.',
    licence: 'MIT',
    url: 'https://colyseus.io',
    group: 'game',
    packages: [
      '@colyseus/core',
      '@colyseus/schema',
      '@colyseus/sdk',
      '@colyseus/testing',
      '@colyseus/tools',
      '@colyseus/ws-transport',
    ],
  },
  {
    name: 'Zod',
    what: 'Checks that your game’s data is the right shape before the game runs.',
    licence: 'MIT',
    url: 'https://zod.dev',
    group: 'game',
    packages: ['zod'],
  },
  {
    name: 'Paraglide',
    what: 'Shows the game’s words in the player’s own language.',
    licence: 'MIT',
    url: 'https://paraglidejs.com',
    group: 'game',
    packages: ['@inlang/paraglide-js', '@inlang/plugin-message-format'],
  },
  {
    name: 'Tauri',
    what: 'Turns a game into an app for Windows, Mac and Linux.',
    licence: 'MIT or Apache 2.0',
    url: 'https://tauri.app',
    group: 'game',
    packages: ['@tauri-apps/api', '@tauri-apps/plugin-process', '@tauri-apps/plugin-store'],
  },
  {
    name: 'Svelte',
    what: 'Builds the menus, buttons and screens in games and editors.',
    licence: 'MIT',
    url: 'https://svelte.dev',
    group: 'game',
    packages: ['svelte', '@sveltejs/package', '@sveltejs/vite-plugin-svelte', 'svelte-check'],
  },

  // Builds and ships your game
  {
    name: 'Vite',
    what: 'Bundles your game into files a browser can open, and shows changes as you type.',
    licence: 'MIT',
    url: 'https://vite.dev',
    group: 'ship',
    packages: ['vite'],
  },
  {
    name: 'Effect',
    what: 'Keeps the command-line tools tidy, so each step can fail with a clear message.',
    licence: 'MIT',
    url: 'https://effect.website',
    group: 'ship',
    packages: ['effect'],
  },
  {
    name: 'Playwright',
    what: 'Opens real browsers to play-test a game and take its pictures.',
    licence: 'Apache 2.0',
    url: 'https://playwright.dev',
    group: 'ship',
    packages: ['playwright', '@playwright/test'],
  },
  {
    name: 'Oxc',
    what: 'Reads game code very fast, so the tools can check it.',
    licence: 'MIT',
    url: 'https://oxc.rs',
    group: 'ship',
    packages: ['oxc-parser'],
  },
  {
    name: 'smol-toml',
    what: 'Reads the TOML files your game’s levels and settings are written in.',
    licence: 'BSD 3-Clause',
    url: 'https://github.com/squirrelchat/smol-toml',
    group: 'ship',
    packages: ['smol-toml'],
  },
  {
    name: 'toml-patch',
    what: 'Saves a change to a TOML file without losing the notes written in it.',
    licence: 'MIT',
    url: 'https://github.com/DecimalTurn/toml-patch',
    group: 'ship',
    packages: ['@decimalturn/toml-patch'],
  },
  {
    name: 'Fontkit',
    what: 'Opens font files to see which letters they hold.',
    licence: 'MIT',
    url: 'https://github.com/foliojs/fontkit',
    group: 'ship',
    packages: ['fontkit'],
  },
  {
    name: 'subset-font',
    what: 'Cuts a font down to the letters a game uses, so it loads fast.',
    licence: 'BSD 3-Clause',
    url: 'https://github.com/papandreou/subset-font',
    group: 'ship',
    packages: ['subset-font'],
  },
  {
    name: 'pngjs',
    what: 'Reads and writes the PNG pictures in a game.',
    licence: 'MIT',
    url: 'https://github.com/pngjs/pngjs',
    group: 'ship',
    packages: ['pngjs'],
  },
  {
    name: 'yazl and yauzl',
    what: 'Make and open the zip files a game is packed in.',
    licence: 'MIT',
    url: 'https://github.com/thejoshwolfe/yazl',
    group: 'ship',
    packages: ['yazl', 'yauzl'],
  },
  {
    name: 'Model Context Protocol',
    what: 'Lets your coding agent use Automata’s tools directly.',
    licence: 'MIT',
    url: 'https://modelcontextprotocol.io',
    group: 'ship',
    packages: ['@modelcontextprotocol/sdk'],
  },

  // The editors and this website
  {
    name: 'SvelteKit',
    what: 'Builds this website.',
    licence: 'MIT',
    url: 'https://svelte.dev/docs/kit',
    group: 'editors',
    packages: ['@sveltejs/kit', '@sveltejs/adapter-static'],
  },
  {
    name: 'CodeMirror',
    what: 'The box you type code into on the try-it page.',
    licence: 'MIT',
    url: 'https://codemirror.net',
    group: 'editors',
    packages: [
      '@codemirror/commands',
      '@codemirror/lang-javascript',
      '@codemirror/language',
      '@codemirror/lint',
      '@codemirror/search',
      '@codemirror/state',
      '@codemirror/view',
      '@lezer/highlight',
    ],
  },
  {
    name: 'Shiki',
    what: 'Colours the code samples on these pages.',
    licence: 'MIT',
    url: 'https://shiki.style',
    group: 'editors',
    packages: ['shiki'],
  },
  {
    name: 'Sucrase',
    what: 'Turns the code you type on the try-it page into code the browser can run.',
    licence: 'MIT',
    url: 'https://github.com/alangpierce/sucrase',
    group: 'editors',
    packages: ['sucrase'],
  },
  {
    name: 'Babel',
    what: 'Reads the code you type on the try-it page, to spot mistakes.',
    licence: 'MIT',
    url: 'https://babel.dev',
    group: 'editors',
    packages: ['@babel/parser'],
  },
  {
    name: 'fflate',
    what: 'Opens zip files you drop into the 3D editor.',
    licence: 'MIT',
    url: 'https://github.com/101arrowz/fflate',
    group: 'editors',
    packages: ['fflate'],
  },

  // Keeps the work honest
  {
    name: 'TypeScript',
    what: 'Catches mistakes in every file before the code runs.',
    licence: 'Apache 2.0',
    url: 'https://www.typescriptlang.org',
    group: 'checks',
    packages: ['typescript'],
  },
  {
    name: 'Vitest',
    what: 'Runs the tests, in Node and in real browsers.',
    licence: 'MIT',
    url: 'https://vitest.dev',
    group: 'checks',
    packages: ['vitest', '@vitest/browser-playwright'],
  },
  {
    name: 'Testing Library',
    what: 'Tests screens the way a person uses them: by what they can see and press.',
    licence: 'MIT',
    url: 'https://testing-library.com',
    group: 'checks',
    packages: [
      '@testing-library/dom',
      '@testing-library/jest-dom',
      '@testing-library/svelte',
      '@testing-library/user-event',
    ],
  },
  {
    name: 'jsdom',
    what: 'A pretend browser that makes quick tests possible.',
    licence: 'MIT',
    url: 'https://github.com/jsdom/jsdom',
    group: 'checks',
    packages: ['jsdom'],
  },
  {
    name: 'axe-core',
    what: 'Checks every page for things that lock people out, like missing labels.',
    licence: 'MPL 2.0',
    url: 'https://github.com/dequelabs/axe-core-npm',
    group: 'checks',
    packages: ['@axe-core/playwright'],
  },
  {
    name: 'Lighthouse CI',
    what: 'Scores how fast and well-built these pages are.',
    licence: 'Apache 2.0',
    url: 'https://github.com/GoogleChrome/lighthouse-ci',
    group: 'checks',
    packages: ['@lhci/cli'],
  },
  {
    name: 'Biome',
    what: 'Tidies the code and catches slips.',
    licence: 'MIT or Apache 2.0',
    url: 'https://biomejs.dev',
    group: 'checks',
    packages: ['@biomejs/biome'],
  },
  {
    name: 'Turborepo',
    what: 'Runs the repository’s jobs in order and skips what has not changed.',
    licence: 'MIT',
    url: 'https://turborepo.dev',
    group: 'checks',
    packages: ['turbo'],
  },
  {
    name: 'tsdown',
    what: 'Packs our libraries for npm.',
    licence: 'MIT',
    url: 'https://tsdown.dev',
    group: 'checks',
    packages: ['tsdown'],
  },
  {
    name: 'Knip',
    what: 'Finds code and packages that nobody uses.',
    licence: 'ISC',
    url: 'https://knip.dev',
    group: 'checks',
    packages: ['knip'],
  },
  {
    name: 'Lefthook',
    what: 'Runs the checks before every save to the project’s history.',
    licence: 'MIT',
    url: 'https://github.com/evilmartians/lefthook',
    group: 'checks',
    packages: ['lefthook'],
  },
  {
    name: 'Changesets',
    what: 'Keeps release notes and version numbers honest.',
    licence: 'MIT',
    url: 'https://changesets.dev',
    group: 'checks',
    packages: ['@changesets/cli'],
  },
  {
    name: 'Wrangler',
    what: 'Sends the finished website to its web host.',
    licence: 'MIT or Apache 2.0',
    url: 'https://github.com/cloudflare/workers-sdk',
    group: 'checks',
    packages: ['wrangler'],
  },

  // Pictures and type
  {
    name: 'Poly Haven',
    what: 'Free photos of brick, wood, plaster and more, which the 3D starter’s walls and floors are made from.',
    licence: 'CC0',
    url: 'https://polyhaven.com',
    group: 'art',
    packages: [],
  },
  {
    name: 'DUEL palette',
    what: 'The 256 colours the pixel art is limited to. Listed on Lospec, submitted by Arilyn.',
    licence: 'No licence stated',
    url: 'https://lospec.com/palette-list/duel',
    group: 'art',
    packages: [],
  },
  {
    name: 'Geist',
    what: 'The typeface in the editors, on this website and in the words a game draws on screen.',
    licence: 'SIL Open Font 1.1',
    url: 'https://fontsource.org/fonts/geist',
    group: 'art',
    packages: ['@fontsource-variable/geist', '@fontsource-variable/geist-mono'],
  },
  {
    name: 'Pixelify Sans',
    what: 'The pixel typeface in the starter game.',
    licence: 'SIL Open Font 1.1',
    url: 'https://fontsource.org/fonts/pixelify-sans',
    group: 'art',
    packages: ['@fontsource/pixelify-sans'],
  },
]
