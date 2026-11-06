import { parseArgs } from 'node:util'

// The `automata ship` command line, parsed into one value per command so ship-cli.ts can switch on it.

/** Where a build goes. It is always named: there is no default target (U5). */
export type ShipTarget = 'web' | 'ruken' | 'itch' | 'tauri'

export type CliCommand =
  | {
      readonly command: 'prepare'
      readonly dist: string
      readonly tag: string | undefined
      readonly target: ShipTarget
    }
  | {
      readonly command: 'publish'
      readonly dist: string
      readonly tag: string | undefined
      readonly activate: boolean
      readonly game: string | undefined
      readonly target: ShipTarget
      /** Upload to Ruken's local stack only, so the build may contain `@pixi/3d`. Ruken only. */
      readonly private?: true
      /** Push the desktop bundles in `dist-tauri/` to itch.io's Downloadable channels. itch only. */
      readonly from?: 'tauri'
    }
  | { readonly command: 'help' }
  | { readonly command: 'usage'; readonly problem: string }

export const USAGE = `Usage: automata ship prepare --target web|itch|tauri|ruken [--dist <dir>] [--tag vX.Y.Z]
       automata ship publish --target itch|ruken [--dist <dir>] [--tag vX.Y.Z]
       automata ship publish --target ruken [--activate] [--game <publicId>] [--private]
       automata ship publish --target itch --from tauri [--dist <dir>] [--tag vX.Y.Z]

Every command names its target. --dist is the folder you built (default: dist). --tag is the release, like v1.2.0.

prepare checks the build for one place to publish it, and changes nothing unless it says so.
  --target web     Checks for what no public site accepts: secrets, pictures or sounds folded into the code, code that
                   needs eval, the private Pixi 3D beta and paths that start with "/". Then upload the folder to any
                   static host.
  --target itch    Checks itch.io's rules and writes <id>-<version>-itch.zip beside the build.
  --target tauri   Builds the desktop app for this computer into dist-tauri/. Needs cargo, Tauri's command line tool
                   and a tauri section in ship.config.ts.
  --target ruken   Writes ruken.toml into the build, from ship.config.ts, and checks it.

publish prepares the build, then uploads it.
  --target itch    Pushes with butler. Needs BUTLER_API_KEY, butler, and itch.project in ship.config.ts.
                   --from tauri pushes the desktop apps in dist-tauri/ instead (run prepare --target tauri first).
  --target ruken   Needs RUKEN_API and RUKEN_TOKEN. --activate makes it live, --game picks the game, and --private
                   uploads a build that is not public (Ruken's local test server only).`

const common = { dist: { type: 'string', default: 'dist' }, tag: { type: 'string' } } as const
const targeted = { ...common, target: { type: 'string' } } as const

/** The target as typed. Throws the sentence the player of the command reads when it is missing or not one of ours. */
function shipTarget(value: string | undefined, choices: string): ShipTarget {
  if (value === undefined) throw new Error(`Choose a target: --target ${choices}.`)
  if (value === 'web' || value === 'ruken' || value === 'itch' || value === 'tauri') return value
  throw new Error(`unknown target: ${value} (web, itch, tauri or ruken)`)
}

export function parseCliArgs(argv: readonly string[]): CliCommand {
  const [command, ...rest] = argv
  if (command === undefined) return { command: 'usage', problem: 'no command' }
  if (command === 'help' || command === '--help' || command === '-h') return { command: 'help' }
  try {
    if (command === 'prepare') {
      const { values } = parseArgs({ args: rest, options: targeted, strict: true })
      return {
        command,
        dist: values.dist,
        tag: values.tag,
        target: shipTarget(values.target, 'web, itch, tauri or ruken'),
      }
    }
    if (command === 'publish') {
      const options = {
        ...targeted,
        activate: { type: 'boolean', default: false },
        game: { type: 'string' },
        private: { type: 'boolean', default: false },
        from: { type: 'string' },
      } as const
      const { values } = parseArgs({ args: rest, options, strict: true })
      const target = shipTarget(values.target, 'itch or ruken')
      if (values.from !== undefined && values.from !== 'tauri')
        throw new Error(`unknown --from: ${values.from} (tauri)`)
      if (values.from === 'tauri' && target !== 'itch') {
        throw new Error('--from tauri pushes desktop bundles to itch.io: use it with --target itch')
      }
      if (target === 'tauri') {
        throw new Error('publish has no tauri target: prepare --target tauri builds the desktop bundles')
      }
      if (target === 'web') {
        throw new Error(
          'There is nothing to publish for web. After prepare --target web, upload the dist folder to any static host.',
        )
      }
      if (target === 'itch' && (values.activate || values.game !== undefined)) {
        throw new Error('--activate and --game are for publishing to Ruken, not itch.io')
      }
      if (target === 'itch' && values.private)
        throw new Error('--private is for Ruken’s local stack; an itch.io page is public')
      return {
        command,
        dist: values.dist,
        tag: values.tag,
        activate: values.activate,
        game: values.game,
        target,
        ...(values.private ? { private: true as const } : {}),
        ...(values.from === 'tauri' ? { from: 'tauri' as const } : {}),
      }
    }
  } catch (error) {
    return { command: 'usage', problem: error instanceof Error ? error.message : String(error) }
  }
  return { command: 'usage', problem: `unknown command: ${command}` }
}
