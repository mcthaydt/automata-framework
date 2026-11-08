// The game's checks, the page's half: the game's own commands run where the game is (`automata editor`, `/api/checks/run`),
// so the page names a check by id and sends the text of the files it wants tried. The token goes with the request, as the
// store sends it.
import type { CheckResult } from '../ports/suite-ports.ts'

export interface ChecksClientOptions {
  /** The editor server's origin. */
  readonly base: string
  readonly token?: string | undefined
  readonly fetch?: typeof fetch | undefined
}

export interface ChecksClient {
  /** Runs the checks on the server; rejects, in words, when the server cannot be reached or refuses. */
  run(
    checks: readonly string[],
    candidates: readonly { readonly path: string; readonly text: string }[],
    signal: AbortSignal,
  ): Promise<readonly CheckResult[]>
}

const STOPPED = 'The editor’s command has stopped. Start automata editor again, then try again.'

export function createChecksClient(options: ChecksClientOptions): ChecksClient {
  const fetchFn = options.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args))
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    ...(options.token === undefined ? {} : { authorization: `Bearer ${options.token}` }),
  }
  return {
    async run(checks, candidates, signal) {
      let answer: Response
      try {
        answer = await fetchFn(`${options.base}/api/checks/run`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ checks, candidates }),
          signal,
        })
      } catch (error) {
        if (signal.aborted) throw error
        throw new Error(STOPPED)
      }
      const body = (await answer.json().catch(() => ({}))) as Partial<{
        results: CheckResult[]
        message: string
      }>
      if (!answer.ok || body.results === undefined)
        throw new Error(body.message ?? 'The editor’s command did not run the check.')
      return body.results
    },
  }
}
