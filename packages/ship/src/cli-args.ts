import { parseArgs } from 'node:util'

// The `automata-ship` command line, parsed into one value per command so cli.ts can switch on it.

export type CliCommand =
  | { readonly command: 'prepare'; readonly dist: string; readonly tag: string | undefined }
  | {
      readonly command: 'publish'
      readonly dist: string
      readonly tag: string | undefined
      readonly activate: boolean
      readonly game: string | undefined
    }
  | {
      readonly command: 'deploy-dev'
      readonly dist: string
      readonly tag: string | undefined
      readonly activate: boolean
    }
  | { readonly command: 'test-remote'; readonly args: readonly string[] }
  | { readonly command: 'usage'; readonly problem: string }

export const USAGE = `Usage: automata-ship prepare    [--dist <dir>] [--tag vX.Y.Z]
       automata-ship publish    [--dist <dir>] [--tag vX.Y.Z] [--activate] [--game <publicId>]
       automata-ship deploy-dev [--dist <dir>] [--tag vX.Y.Z] [--activate]
       automata-ship test-remote [<playwright args> | --nightly]

prepare      writes ruken.toml into the build (from ship.config.ts) and checks it with Ruken's parser
publish      prepare, then ruken publish (packs, validates, uploads). Needs RUKEN_API and RUKEN_TOKEN.
deploy-dev   prepare, then install the build on the dev host. Needs SHIP_DEV_TARGET and SHIP_DEV_URL;
             SHIP_DEV_SSH_KEY_FILE and SHIP_DEV_KNOWN_HOSTS_FILE pick the key and known hosts.
test-remote  push this branch and run CI for it remotely, waiting for the result`

const common = { dist: { type: 'string', default: 'dist' }, tag: { type: 'string' } } as const

export function parseCliArgs(argv: readonly string[]): CliCommand {
  const [command, ...rest] = argv
  if (command === undefined) return { command: 'usage', problem: 'no command' }
  if (command === 'test-remote') return { command, args: rest }
  try {
    if (command === 'prepare') {
      const { values } = parseArgs({ args: rest, options: common, strict: true })
      return { command, dist: values.dist, tag: values.tag }
    }
    if (command === 'publish') {
      const options = {
        ...common,
        activate: { type: 'boolean', default: false },
        game: { type: 'string' },
      } as const
      const { values } = parseArgs({ args: rest, options, strict: true })
      return { command, dist: values.dist, tag: values.tag, activate: values.activate, game: values.game }
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
