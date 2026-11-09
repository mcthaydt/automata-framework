// What the Home page says, in one place so a test can hold each claim to the framework as it is: the command is the
// one `create-game` answers to, the code is the shapes example's own lines, and each target's command is one
// `automata ship` accepts (the four targets of ADR 0006). The page itself only lays these out.

/** The first command a new author runs. */
export const CREATE_COMMAND = 'npx @automata/tools create-game my-game'

/** The three reasons on Home, each something the framework does today. */
export const REASONS = [
  {
    icon: 'terminal',
    title: 'Built for agents',
    body: 'Your game comes with tests, so your coding agent can check its own work after every change.',
  },
  {
    icon: 'check',
    title: 'The same game everywhere',
    body: 'The same seed and inputs give the same game in Node, Chrome, Safari and Firefox, checked bit for bit, so a test means something.',
  },
  {
    icon: 'share',
    title: 'Checked before it ships',
    body: 'One command checks the build for the place you publish it: the web, itch.io, a desktop app or Ruken.',
  },
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
    [Block.id]: rect({ w: 16, h: 16, color: 0x00cdf9 }),
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
