import { parseArgs } from 'node:util'

// The `automata-ship` command line, parsed into one value per command so cli.ts can switch on it.

/** Where a build goes (PUB spec §3). Undefined means Ruken, the default, so existing scripts do not change. */
export type ShipTarget = 'ruken' | 'itch'

export type CliCommand =
  | {
      readonly command: 'prepare'
      readonly dist: string
      readonly tag: string | undefined
      readonly target: ShipTarget | undefined
    }
  | {
      readonly command: 'publish'
      readonly dist: string
      readonly tag: string | undefined
      readonly activate: boolean
      readonly game: string | undefined
      readonly target: ShipTarget | undefined
    }
  | {
      readonly command: 'deploy-dev'
      readonly dist: string
      readonly tag: string | undefined
      readonly activate: boolean
    }
  | { readonly command: 'test-remote'; readonly args: readonly string[] }
  | { readonly command: 'usage'; readonly problem: string }

export const USAGE = `Usage: automata-ship prepare    [--dist <dir>] [--tag vX.Y.Z] [--target ruken|itch]
       automata-ship publish    [--dist <dir>] [--tag vX.Y.Z] [--activate] [--game <publicId>]
       automata-ship publish    --target itch [--dist <dir>] [--tag vX.Y.Z]
       automata-ship deploy-dev [--dist <dir>] [--tag vX.Y.Z] [--activate]
       automata-ship test-remote [<playwright args> | --nightly]

prepare      writes ruken.toml into the build (from ship.config.ts) and checks it with Ruken's parser
             --target itch: checks the build against itch.io's rules and writes <id>-<version>-itch.zip beside it
publish      prepare, then ruken publish (packs, validates, uploads). Needs RUKEN_API and RUKEN_TOKEN.
             --target itch: prepare --target itch, then butler push. Needs BUTLER_API_KEY, butler on PATH and
             itch.project in ship.config.ts.
deploy-dev   prepare, then install the build on the dev host. Needs SHIP_DEV_TARGET and SHIP_DEV_URL;
             SHIP_DEV_SSH_KEY_FILE and SHIP_DEV_KNOWN_HOSTS_FILE pick the key and known hosts.
test-remote  push this branch and run CI for it remotely, waiting for the result`

const common = { dist: { type: 'string', default: 'dist' }, tag: { type: 'string' } } as const
const targeted = { ...common, target: { type: 'string' } } as const

function shipTarget(value: string | undefined): ShipTarget | undefined {
  if (value === undefined || value === 'ruken' || value === 'itch') return value
  throw new Error(`unknown target: ${value} (ruken or itch)`)
}

export function parseCliArgs(argv: readonly string[]): CliCommand {
  const [command, ...rest] = argv
  if (command === undefined) return { command: 'usage', problem: 'no command' }
  if (command === 'test-remote') return { command, args: rest }
  try {
    if (command === 'prepare') {
      const { values } = parseArgs({ args: rest, options: targeted, strict: true })
      return { command, dist: values.dist, tag: values.tag, target: shipTarget(values.target) }
    }
    if (command === 'publish') {
      const options = {
        ...targeted,
        activate: { type: 'boolean', default: false },
        game: { type: 'string' },
      } as const
      const { values } = parseArgs({ args: rest, options, strict: true })
      const target = shipTarget(values.target)
      if (target === 'itch' && (values.activate || values.game !== undefined)) {
        throw new Error('--activate and --game are for publishing to Ruken, not itch.io')
      }
      return {
        command,
        dist: values.dist,
        tag: values.tag,
        activate: values.activate,
        game: values.game,
        target,
      }
    }
    if (command === 'deploy-dev') {
      const options = { ...common, activate: { type: 'boolean', default: false } } as const
      const { values } = parseArgs({ args: rest, options, strict: true })
      return { command, dist: values.dist, tag: values.tag, activate: values.activate }
    }
  } catch (error) {
    return { command: 'usage', problem: error instanceof Error ? error.message : String(error) }
  }
  return { command: 'usage', problem: `unknown command: ${command}` }
}
