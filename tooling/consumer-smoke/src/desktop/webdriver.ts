// Drives a built desktop game through tauri-driver, the W3C WebDriver server Tauri ships, which on Linux starts the app
// and hands its window to WebKitWebDriver. Plain `fetch` speaks the protocol: the desktop journey needs five calls,
// and a WebDriver client library would be one more dependency to pin for them.

/** The pinned tauri-driver: 2.1.0, released 2026-09-26, the newest stable release at least 14 days old. */
export const TAURI_DRIVER = 'tauri-driver@2.1.0'

/** What the journey needs on a Linux machine besides the build toolchain, and the command that installs each. */
const DESKTOP_TOOLS: readonly (readonly [tool: string, install: string])[] = [
  // A screen with no monitor, and a window manager on it: closing a window is the window manager's message.
  ['Xvfb', 'sudo apt install xvfb'],
  ['openbox', 'sudo apt install openbox'],
  ['wmctrl', 'sudo apt install wmctrl'],
  ['WebKitWebDriver', 'sudo apt install webkit2gtk-driver'],
  ['tauri-driver', `cargo install ${TAURI_DRIVER} --locked`],
]

/** Each tool `isInstalled` does not find, as `tool: the command that installs it`. */
export function missingDesktopTools(isInstalled: (tool: string) => boolean): string[] {
  return DESKTOP_TOOLS.filter(([tool]) => !isInstalled(tool)).map(([tool, install]) => `${tool}: ${install}`)
}

/**
 * The longest one WebDriver request may take. Starting the app is the slowest call (well under a second here); a
 * driver that takes the connection and never answers would otherwise hold the journey until Vitest's 30 minutes.
 */
const REQUEST_TIMEOUT_MS = 60_000

/**
 * Where tauri-driver listens, how to reach it (a fake in tests), how often `until` asks again, and how long one
 * request may take.
 */
export interface WebDriverOptions {
  readonly base: string
  readonly fetcher?: typeof fetch
  readonly pollMs?: number
  readonly requestTimeoutMs?: number
}

/** One running app: scripts run in its window, and ending the session stops the app if it still runs. */
export interface TauriSession {
  /** Runs `script` (a function body; `return` its answer) in the app's window and resolves to the answer. */
  execute(script: string): Promise<unknown>
  /** Runs `script` until it answers something truthy, and resolves to that; rejects naming it after `timeoutMs`. */
  until(script: string, timeoutMs: number): Promise<unknown>
  end(): Promise<void>
}

/** Starts the app at `application` (the built binary) and resolves once its window can run scripts. */
export async function startTauriSession(
  application: string,
  options: WebDriverOptions,
): Promise<TauriSession> {
  const fetcher = options.fetcher ?? fetch
  const pollMs = options.pollMs ?? 250
  const requestTimeoutMs = options.requestTimeoutMs ?? REQUEST_TIMEOUT_MS

  const call = async (method: string, path: string, body?: unknown): Promise<unknown> => {
    const what = `WebDriver ${method} ${path}`
    let response: Response
    let text: string
    try {
      response = await fetcher(`${options.base}${path}`, {
        method,
        headers: { 'content-type': 'application/json' },
        signal: AbortSignal.timeout(requestTimeoutMs),
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      })
      text = await response.text()
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'TimeoutError')
        throw new Error(`${what} did not answer within ${requestTimeoutMs} ms`, { cause })
      throw cause
    }
    let value: unknown
    try {
      value = (JSON.parse(text) as { value: unknown }).value
    } catch {
      throw new Error(`${what} failed: ${response.status} ${text}`)
    }
    if (!response.ok) throw new Error(`${what} failed: ${JSON.stringify(value)}`)
    return value
  }

  const created = (await call('POST', '/session', {
    capabilities: { alwaysMatch: { 'tauri:options': { application } } },
  })) as { sessionId: string }
  const session = `/session/${created.sessionId}`
  const execute = (script: string) => call('POST', `${session}/execute/sync`, { script, args: [] })

  return {
    execute,
    until: async (script, timeoutMs) => {
      const deadline = Date.now() + timeoutMs
      for (;;) {
        const answer = await execute(script)
        if (answer) return answer
        if (Date.now() >= deadline) throw new Error(`the app never answered truthy to: ${script}`)
        await new Promise((resolve) => setTimeout(resolve, pollMs))
      }
    },
    end: async () => void (await call('DELETE', session)),
  }
}
