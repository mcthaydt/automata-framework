// What the Home page says, in one place so a test can hold each claim to the framework as it is: the command is the
// one `create-game` answers to, the code is the shapes example's own lines, and each target's command is one
// `automata ship` accepts (the four targets of ADR 0006). The numbers are not here: they are read from the workspace
// (`virtual:framework/facts`). The page itself only lays these out.
import { AGENT_PROMPT, CREATE_COMMAND } from '../../shared/content/agent-prompt'

export { AGENT_PROMPT, CREATE_COMMAND }

/** The words on the demo's one bar (spec section 7): every state of it, so the runner holds no copy of its own. */
export interface DemoBar {
  readonly title: string
  readonly tagline: string
  readonly play: string
  readonly fullScreen: string
  readonly exitFullScreen: string
  readonly stop: string
  readonly starting: string
  readonly failed: string
  readonly retry: string
  readonly noFullScreen: string
  readonly fullScreenSlow: string
  /** What the keyboard does, said beside the buttons on a screen that has one. */
  readonly keys: readonly string[]
  readonly keysWords: string
}

export const DEMO_BAR: DemoBar = {
  title: 'Emberwick',
  tagline: 'A platformer made with Automata',
  play: 'Play it',
  fullScreen: 'Full screen',
  exitFullScreen: 'Exit full screen',
  stop: 'Stop',
  starting: 'Starting Emberwick…',
  failed: "Emberwick didn't start.",
  retry: 'Try again',
  noFullScreen: "Full screen isn't available here.",
  fullScreenSlow: "Full screen didn't start.",
  keys: ['←', '→', 'Space'],
  keysWords: 'to play',
}

/** The announcement above the title: one pill, to the page it names. */
export const ANNOUNCEMENT = {
  tag: 'New',
  words: 'The level editor, in your browser',
  href: '/editor',
} as const

/** The title and its line under it. */
export const HERO = {
  title: 'Make browser games with your coding agent.',
  lead: 'Automata is a TypeScript framework for 2D web games. Your agent writes the code and the tests. You draw the levels and play it in a tab.',
} as const

/** The words of the actions under the title. */
export const ACTIONS = { make: 'Make a game', copyPrompt: 'Copy the prompt for your agent' } as const

/** What the numbers row says after each number. The numbers are read from the workspace, not written here. */
export const FACT_WORDS = {
  engines: 'Node, Chrome, Safari and Firefox give the same hash',
  examples: 'each one runnable in the browser',
  targets: 'web, itch.io, desktop and Ruken',
  licence: 'licensed, TypeScript throughout',
} as const

/** The studios that ship on Automata, as the carousel shows them: a name, the logo's files and where it goes. */
export const MADE_WITH = [
  {
    name: 'SNEKPRTY',
    href: null,
    sources: [
      { src: '/made-with/snekprty-224.webp', width: 224 },
      { src: '/made-with/snekprty-320.webp', width: 320 },
    ],
    height: 80,
    width: 320,
  },
] as const

/** What the first section says: the code beside what it draws, with three plain points. */
export const AGENT_SECTION = {
  kicker: 'Built for agents',
  title: 'Your agent writes the game. The framework keeps it honest.',
  sub: 'Gameplay is plain components and systems in small files, so an agent can find what to change and prove it still works.',
  points: [
    ['Agent skills', 'tell your agent where gameplay lives and the rules it must keep.'],
    ['One command,', '`automata check`, runs the rules, the types and the tests.'],
    ['Drawing is separate', 'from the game, so a test runs the real logic with no screen.'],
  ],
} as const

/** The determinism section: the claim and what its table says. The table's rows come from the facts. */
export const DETERMINISM = {
  kicker: 'Deterministic',
  title: 'The same game in every browser, to the last bit.',
  sub: 'The game runs on a fixed tick with a seeded random. A recorded run gives the same result everywhere, so a passing test means the game really works.',
  file: 'shapes-rects.replay',
  note: 'checked on every pull request',
  result: 'Same hash',
} as const

/** The editor section. */
export const EDITOR_SECTION = {
  kicker: 'The editor',
  title: 'Draw levels. The game reads the same files.',
  sub: 'The level editor runs in your browser. It saves the content files in your game, and the game picks them up on the next run.',
  points: [
    ['Paint', 'tiles, characters and items with six tools.'],
    ['Problems', 'are listed as you draw, before the game ever runs.'],
  ],
} as const

/** The six examples Home shows, by id, in this order (each is in the examples catalogue). */
export const HOME_EXAMPLES = [
  'shapes-rects',
  'shapes-draw-hud',
  'textures-atlas',
  'textures-sprite',
  'render-filter',
  'core-camera-2d',
] as const

/** The example Home shows, and the lines of it shown: each one is in the file as written. */
export const EXAMPLE_FILE = 'shapes-rects.ts'
export const EXAMPLE_PATH = 'examples/2d/shapes/shapes-rects.ts'
export const EXAMPLE_EXCERPT = `const Block = defineComponent('block', { x: 'f32', y: 'f32' })

const move = defineSystem('move', (ctx) => {
  for (const block of ctx.query(Block)) {
    const { y } = block.get(Block)
    block.set(Block, { y: y > 196 ? -16 : y + 1 })
  }
})

export default defineGame({
  id: 'shapes-rects',
  size: { width: 320, height: 180 },
  views: {
    [Block.id]: rect({ w: 16, h: 16, color: 0x52d2ff }),
  },
})`

/** Where a game goes: the four peer targets, each with the command that publishes it (shown on two lines). */
export const TARGETS = [
  {
    icon: 'globe',
    title: 'The web',
    body: 'Checked for what a public site refuses, then ready for any static host.',
    command: 'automata ship prepare --target web',
  },
  {
    icon: 'gamepad',
    title: 'itch.io',
    body: 'Checked and uploaded to your itch.io page, ready to play in the browser.',
    command: 'automata ship publish --target itch',
  },
  {
    icon: 'monitor',
    title: 'A desktop app',
    body: 'Built with Tauri for Windows, macOS and Linux, and published as a download on itch.io.',
    command: 'automata ship publish --target itch --from tauri',
  },
  {
    icon: 'store',
    title: 'Ruken',
    body: "Checked against Ruken's rules and published to Ruken in one step.",
    command: 'automata ship publish --target ruken',
  },
] as const

/** The changelog section: the list is read from the changesets, so only its words are here. */
export const CHANGELOG_SECTION = {
  kicker: 'Changelog',
  title: 'Landing in the first release.',
  all: 'Full changelog',
  count: 4,
} as const

/** The closing band. */
export const CLOSING = {
  title: 'Make your first game this afternoon.',
  body: 'One command makes a working game. Play it, change it with your agent, and publish it.',
} as const
