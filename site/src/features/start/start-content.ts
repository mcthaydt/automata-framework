// Start's four steps, each one command and what you see after it. Each command is one the framework answers to: the
// first is `create-game`, the second what it prints next, the third the editor's, the fourth the web build's from its
// guide (the test holds them to those files).

export interface Step {
  readonly title: string
  readonly command: string
  readonly what: string
}

export const STEPS: readonly Step[] = [
  {
    title: '1. Make a game',
    command: 'npx @mcthaydt/automata-tools create-game my-game',
    what: 'A folder called my-game with a small working platformer in it: a level, a player and its tests.',
  },
  {
    title: '2. Play it',
    command: 'cd my-game && pnpm install && pnpm dev',
    what: 'The game opens in your browser. Change a file and it updates while you play.',
  },
  {
    title: '3. Draw its level',
    command: 'pnpm exec automata editor',
    what: 'The level editor opens on your game. Draw, press Save, and the running game picks up the change.',
  },
  {
    title: '4. Put it online',
    command: 'pnpm build:web && pnpm prepare:web',
    what: 'A checked build in dist/, ready for any static host. itch.io, a desktop app and Ruken have their own guides.',
  },
]

/** The guides for the other places a game goes, from the framework's docs. */
export const PUBLISH_GUIDES = [
  ['/docs/publish-to-itch', 'itch.io'],
  ['/docs/publish-to-desktop', 'A desktop app'],
  ['/docs/publish-to-ruken', 'Ruken'],
] as const
