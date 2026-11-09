// itch.io, the first place Publish offers. It pushes the zip Publish made with butler, itch.io's own uploader, signed in
// with the person's own itch.io account (`butler login`) or their `BUTLER_API_KEY`. The key is butler's: nothing here
// reads, writes or passes it on. The one file written is `ship.config.ts`, with the page's address, so the next push
// and `automata ship publish` agree.
import { spawn } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { findExecutable } from '../../../shared/ship/publish/find-executable.ts'
import type { Place, PlaceOutcome } from './place.ts'

/** What the itch.io place touches outside itself, so a test can answer for each. */
export interface ItchPlaceDeps {
  readonly findButler: () => string | undefined
  /** butler has a login: the person's key in `BUTLER_API_KEY`, or the one `butler login` stored. */
  readonly signedIn: () => boolean
  readonly run: (
    command: string,
    args: readonly string[],
    cwd: string,
  ) => Promise<{ readonly code: number; readonly output: string }>
  readonly read: (path: string) => string | undefined
  readonly write: (path: string, text: string) => void
  /** The game's version, from its `package.json`. */
  readonly version: (root: string) => string
}

const GET_BUTLER = {
  label: 'Get itch.io’s uploader',
  href: 'https://itch.io/docs/butler/installing.html',
}
const MAKE_PAGE = { label: 'Make a page on itch.io', href: 'https://itch.io/game/new' }

/**
 * `user/game` from the address a person pastes: `your-name.itch.io/my-game`, with or without `https://`, or butler's own
 * `your-name/my-game`. Lower case, as butler names a project.
 */
export function pageToProject(page: string): string | undefined {
  const text = page
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '')
  const site = /^([a-z0-9][a-z0-9_-]*)\.itch\.io\/([a-z0-9][a-z0-9._-]*)$/.exec(text)
  const plain = /^([a-z0-9][a-z0-9_-]*)\/([a-z0-9][a-z0-9._-]*)$/.exec(text)
  const found = site ?? plain
  return found === null || found === undefined ? undefined : `${found[1]}/${found[2]}`
}

const ITCH_SECTION = /itch:\s*\{[^}]*\}/

/**
 * `ship.config.ts` with the itch.io project set. A game made without the itch target has no section: it is added at the
 * end of the config, with the `html5` channel butler pushes to.
 */
export function withItchProject(config: string, project: string): string {
  const section = ITCH_SECTION.exec(config)?.[0]
  if (section !== undefined) {
    const changed = /project:\s*'[^']*'/.test(section)
      ? section.replace(/project:\s*'[^']*'/, `project: '${project}'`)
      : section.replace(/\{\s*/, `{ project: '${project}', `)
    return config.replace(section, changed)
  }
  const end = config.lastIndexOf('})')
  if (end === -1) return config
  const before = config.slice(0, end).replace(/\s*$/, '\n')
  return `${before}  itch: { project: '${project}', channel: 'html5' },\n${config.slice(end)}`
}

const channelOf = (config: string): string =>
  /itch:\s*\{[^}]*channel:\s*'([a-z0-9][a-z0-9._-]*)'/.exec(config)?.[1] ?? 'html5'

// What butler prints when the page is not there, or when it refuses the login. It is the one signal there is: butler
// has no exit code for either.
const NO_PAGE = /not found|no such|404|invalid target|does not exist|doesn't exist/i
const REFUSED = /api key|credential|log ?in|unauthori[sz]ed|forbidden|not authenticated/i

/** The itch.io place over `deps`. */
export function createItchPlace(deps: ItchPlaceDeps): Place {
  const missing = (): PlaceOutcome => ({
    ok: false,
    need: 'butler',
    problem: 'butler, itch.io’s uploader, is not on this computer yet. Get it, then try again.',
    help: GET_BUTLER,
  })
  return {
    id: 'itch',
    name: 'itch.io',
    asks: [{ id: 'page', label: 'Your itch.io page', example: 'your-name.itch.io/my-game' }],
    note: 'On your itch.io page, set its kind to HTML. Without that, itch.io will not play the game.',
    async put(root, zip, answers) {
      const butler = deps.findButler()
      if (butler === undefined) return missing()
      const project = pageToProject(answers.page ?? '')
      if (project === undefined) {
        return {
          ok: false,
          need: 'project',
          problem:
            'That does not look like an itch.io page address. It looks like your-name.itch.io/my-game. Make the page first if you have not.',
          help: MAKE_PAGE,
        }
      }
      if (!deps.signedIn()) {
        return { ok: false, need: 'account', problem: 'Connect your itch.io account first, then try again.' }
      }
      const configPath = join(root, 'ship.config.ts')
      const config = deps.read(configPath)
      if (config !== undefined) deps.write(configPath, withItchProject(config, project))
      const channel = config === undefined ? 'html5' : channelOf(config)
      const pushed = await deps.run(
        butler,
        ['push', zip, `${project}:${channel}`, '--userversion', deps.version(root), '--if-changed'],
        root,
      )
      if (pushed.code === 0) {
        const [user, game] = project.split('/')
        return { ok: true, link: `https://${user}.itch.io/${game}` }
      }
      if (NO_PAGE.test(pushed.output)) {
        return {
          ok: false,
          need: 'project',
          problem: `itch.io has no page at ${project.replace('/', '.itch.io/')}. Make the page, then try again.`,
          help: MAKE_PAGE,
        }
      }
      if (REFUSED.test(pushed.output)) {
        return {
          ok: false,
          need: 'account',
          problem: 'itch.io did not accept your account. Connect it again, then try again.',
        }
      }
      return {
        ok: false,
        need: 'push',
        problem: 'butler could not put your game on itch.io. The lines below say why.',
        detail: pushed.output.trim(),
      }
    },
    async signIn() {
      const butler = deps.findButler()
      if (butler === undefined) return { ok: false, problem: 'butler is not on this computer yet.' }
      const done = await deps.run(butler, ['login'], process.cwd())
      return done.code === 0 ? { ok: true } : { ok: false, problem: 'Connecting to itch.io did not finish.' }
    },
  }
}

/** Where butler keeps the login `butler login` made (itch.io's docs: the `butler_creds` file in its config folder). */
function butlerCreds(env: NodeJS.ProcessEnv, platform: NodeJS.Platform): string {
  if (platform === 'win32')
    return join(env.APPDATA ?? join(homedir(), 'AppData', 'Roaming'), 'itch', 'butler_creds')
  if (platform === 'darwin') return join(homedir(), 'Library', 'Application Support', 'itch', 'butler_creds')
  return join(env.XDG_CONFIG_HOME ?? join(homedir(), '.config'), 'itch', 'butler_creds')
}

/** The real dependencies: butler on PATH, its stored login, a process and the game's files. */
export function liveItchDeps(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): ItchPlaceDeps {
  return {
    findButler: () => findExecutable('butler', env.PATH ?? '', platform),
    signedIn: () => (env.BUTLER_API_KEY ?? '') !== '' || existsSync(butlerCreds(env, platform)),
    run: (command, args, cwd) =>
      new Promise((done) => {
        // The words butler prints (a sign-in address included) are kept to say what happened; its key stays in its own folder.
        const child = spawn(command, [...args], { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] })
        let output = ''
        child.stdout.on('data', (chunk) => {
          output += String(chunk)
        })
        child.stderr.on('data', (chunk) => {
          output += String(chunk)
        })
        child.on('error', (error) => done({ code: 1, output: error.message }))
        child.on('close', (code) => done({ code: code ?? 1, output }))
      }),
    read: (path) => (existsSync(path) ? readFileSync(path, 'utf8') : undefined),
    write: (path, text) => writeFileSync(path, text),
    version: (root) => {
      try {
        return String(
          (JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { version?: unknown }).version ??
            '0.0.0',
        )
      } catch {
        return '0.0.0'
      }
    },
  }
}

export const itchPlace: Place = createItchPlace(liveItchDeps())
