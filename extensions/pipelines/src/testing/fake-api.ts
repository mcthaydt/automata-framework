import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { Effect, type Scope } from 'effect'

// A stand-in for a paid API (an image or a 3D-model provider): a local node:http server on a free port that answers
// every POST with a new task id and counts the requests, so a test can assert that a refusal or a cached stage made
// no call. It never reaches a real provider, and no key is involved.

export interface FakeApi {
  /** `http://127.0.0.1:<port>`. */
  readonly url: string
  /** Every request so far, as `METHOD /path`. */
  readonly requests: () => readonly string[]
}

/** Starts the server for the scope's life; closing the scope stops it. */
export const fakeApi: Effect.Effect<FakeApi, never, Scope.Scope> = Effect.acquireRelease(
  Effect.async<{ readonly api: FakeApi; readonly close: () => Promise<void> }>((resume) => {
    const seen: string[] = []
    const server = createServer((request, response) => {
      seen.push(`${request.method} ${request.url}`)
      request.resume()
      request.on('end', () => {
        response.setHeader('content-type', 'application/json')
        response.end(JSON.stringify({ task: `task-${seen.length}` }))
      })
    })
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo
      resume(
        Effect.succeed({
          api: { url: `http://127.0.0.1:${port}`, requests: () => [...seen] },
          close: () =>
            new Promise<void>((done) => {
              server.close(() => done())
              // fetch keeps connections alive; close them so the scope ends now.
              server.closeAllConnections()
            }),
        }),
      )
    })
  }),
  ({ close }) => Effect.promise(close),
).pipe(Effect.map(({ api }) => api))
