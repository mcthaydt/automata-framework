// `automata editor [dir] [--app-dir <dir>] [--port <n>] [--lan] [--token <t>] [--game-url <url>]`: serve the editors
// against a game checkout. The game's editor list picks the page (`page-for.ts`), so there is no flag for it.

/** Said for `--app`, which used to pick the page. */
export const APP_IS_GONE = 'This option is gone: automata editor picks the editors your game needs.'

export interface EditorOptions {
  /** The game checkout, relative to the working folder. */
  readonly dir: string
  /** A built page to serve instead of the one that comes with the tools (2D) or the repository's (full). */
  readonly appDir: string | undefined
  /** 0 picks a free port. */
  readonly port: number
  /** Listen on every address, so a tablet on the same network can reach it (a token is then made if none is given). */
  readonly lan: boolean
  readonly token: string | undefined
  /** The game's dev page (`pnpm dev`), which the Tuner shows beside its settings; Vite's own port unless told. */
  readonly gameUrl: string
}

/** Where `pnpm dev` serves a game when nothing else holds Vite's port: the page the Tuner shows by default. */
const DEFAULT_GAME_URL = 'http://localhost:5173/'

/** A web page's address, written the one way (`http://localhost:5180/`), or nothing for anything else. */
function webAddress(value: string): string | undefined {
  if (!URL.canParse(value)) return undefined
  const url = new URL(value)
  return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : undefined
}

export type EditorArgs =
  | { readonly ok: true; readonly options: EditorOptions }
  | { readonly ok: false; readonly problem: string }

export function parseEditorArgs(args: readonly string[]): EditorArgs {
  let dir: string | undefined
  let appDir: string | undefined
  let port = 0
  let lan = false
  let token: string | undefined
  let gameUrl = DEFAULT_GAME_URL

  const valueAfter = (index: number): string | undefined => {
    const value = args[index + 1]
    return value === undefined || value === '' || value.startsWith('-') ? undefined : value
  }

  for (let i = 0; i < args.length; i++) {
    const flag = args[i] as string
    if (flag === '--lan') lan = true
    else if (flag === '--app') return { ok: false, problem: APP_IS_GONE }
    else if (['--app-dir', '--port', '--token', '--game-url'].includes(flag)) {
      const value = valueAfter(i)
      if (value === undefined) return { ok: false, problem: `${flag} needs a value` }
      i++
      if (flag === '--app-dir') appDir = value
      else if (flag === '--token') token = value
      else if (flag === '--game-url') {
        const address = webAddress(value)
        if (address === undefined)
          return { ok: false, problem: '--game-url is a web address, like http://localhost:5173' }
        gameUrl = address
      } else {
        const number = Number(value)
        if (!Number.isInteger(number) || number < 0 || number > 65535)
          return { ok: false, problem: '--port is a number from 0 to 65535' }
        port = number
      }
    } else if (flag.startsWith('-')) return { ok: false, problem: `unknown option ${flag}` }
    else if (dir === undefined) dir = flag
    else return { ok: false, problem: `unexpected argument ${flag}` }
  }
  return { ok: true, options: { dir: dir ?? '.', appDir, port, lan, token, gameUrl } }
}
