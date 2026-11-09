// Start's three steps. The first is `create-game`, the second is the command `create-game` prints for you to run next
// (a test holds the two to its source), and the third has no command: Publish is a button in the editors.
import { CREATE_COMMAND } from '../../shared/content/agent-prompt'

export interface Step {
  readonly title: string
  /** The command to paste; none for a step done with a button in the editors. */
  readonly command?: string
  readonly what: string
}

export const STEPS: readonly Step[] = [
  {
    title: '1. Make a game',
    command: CREATE_COMMAND,
    what: 'A folder called my-game with a small working game in it: a square you move around a level, its menus, saves and controls, and its tests.',
  },
  {
    title: '2. Open the editors',
    command: 'cd my-game && pnpm install && pnpm editor',
    what: 'The editors open on your game. Press Play at the top to play it. Place things in Levels and change numbers in the Tuner: every change is saved in your game folder, and the running game picks it up.',
  },
  {
    title: '3. Publish it',
    what: 'Press Publish at the top of the editors. It makes one zip of your game, then offers to put it on itch.io: sign in to itch.io, say which page it is for, and it goes there. Or take the zip and upload it to any website.',
  },
]

/** The guides for the other places a game goes, from the framework's docs. */
export const PUBLISH_GUIDES = [
  ['/docs/publish-to-itch', 'itch.io'],
  ['/docs/publish-to-desktop', 'A desktop app'],
  ['/docs/publish-to-ruken', 'Ruken'],
] as const
