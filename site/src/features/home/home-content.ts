// What the Home page says, in one place so a test can hold each claim to the framework as it is. The words follow the
// GTM research (2026-11-08): the buyer already makes browser games with Claude Code, Cursor or Codex and has not finished
// one, so the page names that wall, shows what is built in, then the price. The command is the
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
  tag: 'Free',
  words: 'Every editor is free in your browser',
  href: '/app',
} as const

/** The title and its line under it. The Owner picks the title from three on a decision card (2026-11-08). */
export const HERO = {
  title: 'Finish the game your agent started.',
  lead: 'Your coding agent can make a playable demo in a weekend. Saves, menus, settings, touch controls and publishing are what take the next six weeks. Automata has them built in.',
} as const

/** The words of the actions under the title. */
export const ACTIONS = {
  make: 'Make a game',
  copyPrompt: 'Copy the prompt for your agent',
} as const

/** What the numbers row says after each number. The numbers are read from the workspace, not written here. */
export const FACT_WORDS = {
  engines: 'Node, Chrome, Safari and Firefox play your game exactly the same way',
  examples: 'small games to start from, each one playable here',
  targets: 'to publish to: the web, itch.io, desktop and Ruken',
  licence: 'licensed and free to use. No credits, ever.',
} as const

/** "Built in": what every game has from its first run, so a demo is already a game. Each one is a part of the framework
 * (saves, the title, pause and settings screens, input with rebinding, audio, display and locale). */
export const BUILT_IN = {
  kicker: 'Built in',
  title: 'The part after the demo is already done.',
  sub: 'Players notice the moment these are missing. Every Automata game starts with them working, so your agent can spend its time on your idea.',
  items: [
    ['Saves', 'Players pick up where they left off.'],
    ['Menus and settings', 'A title screen, a pause screen and a settings screen, ready for your look.'],
    ['Controls', 'Keyboard, touch and gamepad. Players can change the keys.'],
    ['Sound', 'Music and sound effects, with volume players can set.'],
    ['Every screen', 'Phones, tablets and computers, upright or sideways.'],
    ['Languages', "Put your game's words in more than one language."],
  ],
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
  title: 'Made for Claude Code, Cursor and Codex.',
  sub: 'A game is small files with plain names. Your agent finds the right one to change, changes it, and checks that it still works.',
  points: [
    ['Agent skills', 'tell your agent where gameplay lives and the rules it must keep.'],
    ['One command,', '`automata check`, runs the rules, the types and the tests.'],
    ['Your agent, your plan.', 'Automata runs no AI of its own, so there are no credits to run out.'],
  ],
} as const

/** The determinism section: the claim and what its table says. The table's rows come from the facts. */
export const DETERMINISM = {
  kicker: 'Checks',
  title: "Your agent can't quietly break your game.",
  sub: 'The same moves always give the same result, in every browser. Your game comes with tests, and one command runs them after every change. So when your agent breaks something that worked, it sees it before a player does.',
  file: 'shapes-rects.replay',
  note: 'checked on every change',
  result: 'Same result',
} as const

/** The editor section. */
export const EDITOR_SECTION = {
  kicker: 'The editors',
  title: 'Change it yourself, without another prompt.',
  sub: "Your agent writes the code. You, or a friend who doesn't code, change the levels, the feel and the words in free editors in your browser. The game reads what you save.",
  points: [
    ['Draw levels', 'with tiles, characters and items.'],
    ['Tune the feel', 'of a jump, and see it change while you play.'],
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
    body: 'A checked build, ready for any website host.',
    command: 'automata ship prepare --target web',
  },
  {
    icon: 'gamepad',
    title: 'itch.io',
    body: 'Uploaded to your itch.io page, where people play it right in the browser.',
    command: 'automata ship publish --target itch',
  },
  {
    icon: 'monitor',
    title: 'A desktop app',
    body: 'A download for Windows, macOS and Linux, built with Tauri and put on itch.io for you.',
    command: 'automata ship publish --target itch --from tauri',
  },
  {
    icon: 'store',
    title: 'Ruken',
    body: "Checked against Ruken's rules and published to Ruken in one step.",
    command: 'automata ship publish --target ruken',
  },
] as const

/** "Publish": the section's words. The editor's Publish gives one zip to upload (PublishGameDialog); the Owner's "zip, then
 * ask where, itch.io first" (2026-11-08) is not built yet, so Home says only what the button does today. */
export const PUBLISH_SECTION = {
  kicker: 'Publish',
  title: 'Get it in front of players.',
  sub: 'Publish packs your game into one zip. Upload it to itch.io, where people play it right in their browser, or to any website host.',
} as const

/** "Pricing": free on the web, the app paid once. The prices come from `shared/content/pricing.ts`. */
export const PRICING_SECTION = {
  kicker: 'Pricing',
  title: 'Free to make. Pay once for the app.',
  sub: 'Every editor is free in your browser. You bring your own coding agent, so there is nothing for Automata to meter.',
  free: {
    title: 'Free in your browser',
    items: [
      'Every editor, for 2D and 3D games',
      'Sign in with GitHub to keep your games in sync',
      'The framework, MIT licensed',
    ],
  },
  app: {
    title: 'The app, paid once',
    items: [
      'Nothing to set up: no terminal, nothing else to install',
      'Opens like any other app on your iPad, phone or computer',
    ],
  },
  more: 'See what the app does',
} as const

/** The changelog section: the list is read from the changesets, so only its words are here. */
export const CHANGELOG_SECTION = {
  kicker: 'Changelog',
  title: 'Landing in the first release.',
  all: 'Full changelog',
  count: 4,
} as const

/** The closing band. */
export const CLOSING = {
  title: 'Finish your next game.',
  body: 'One command makes a working game with saves, menus and controls in place. Hand it to your agent, change it in the editors, and put it on itch.io.',
} as const
