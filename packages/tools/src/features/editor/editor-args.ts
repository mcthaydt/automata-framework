// `automata editor [dir] [--app 2d|3d|suite] [--app-dir <dir>] [--port <n>] [--lan] [--token <t>]`: serve
// an editor against a game checkout; the 2D editor unless told otherwise. One command for every editor.

export type EditorApp = '2d' | '3d' | 'suite'

export interface EditorOptions {
  /** The game checkout, relative to the working folder. */
  readonly dir: string
  readonly app: EditorApp
  /** A built editor to serve instead of the build that comes with the tools (the 2D editor) or the repository's (3D). */
  readonly appDir: string | undefined
  /** 0 picks a free port. */
  readonly port: number
  /** Listen on every address, so a tablet on the same network can reach it (a token is then made if none is given). */
  readonly lan: boolean
  readonly token: string | undefined
}

export type EditorArgs =
  | { readonly ok: true; readonly options: EditorOptions }
  | { readonly ok: false; readonly problem: string }

const APPS: readonly EditorApp[] = ['2d', '3d', 'suite']
const isApp = (value: string): value is EditorApp => (APPS as readonly string[]).includes(value)

export function parseEditorArgs(args: readonly string[]): EditorArgs {
  let dir: string | undefined
  let app: EditorApp = '2d'
  let appDir: string | undefined
  let port = 0
  let lan = false
  let token: string | undefined

  const valueAfter = (index: number): string | undefined => {
    const value = args[index + 1]
    return value === undefined || value === '' || value.startsWith('-') ? undefined : value
  }

  for (let i = 0; i < args.length; i++) {
    const flag = args[i] as string
    if (flag === '--lan') lan = true
    else if (flag === '--app' || flag === '--app-dir' || flag === '--port' || flag === '--token') {
      const value = valueAfter(i)
      if (value === undefined) return { ok: false, problem: `${flag} needs a value` }
      i++
      if (flag === '--app') {
        if (!isApp(value)) return { ok: false, problem: '--app is 2d, 3d or suite' }
        app = value
      } else if (flag === '--app-dir') appDir = value
      else if (flag === '--token') token = value
      else {
        const number = Number(value)
        if (!Number.isInteger(number) || number < 0 || number > 65535)
          return { ok: false, problem: '--port is a number from 0 to 65535' }
        port = number
      }
    } else if (flag.startsWith('-')) return { ok: false, problem: `unknown option ${flag}` }
    else if (dir === undefined) dir = flag
    else return { ok: false, problem: `unexpected argument ${flag}` }
  }
  return { ok: true, options: { dir: dir ?? '.', app, appDir, port, lan, token } }
}
