import { defineTests, type TestOptions } from '@automata/vitest-preset'
import { svelteTesting } from '@testing-library/svelte/vite'
import type { BrowserCommand } from 'vitest/node'

// `unit` runs the badge and the overlay in jsdom through Testing Library; `browser` lays them out with production CSS at
// the reference sizes in real Chromium, WebKit and Firefox.
//
// The stale-build journey needs what the unit tests cannot have: a server on another origin than the page, answering as
// the real one does. A page cannot start one, so these commands start `@automata/net-server`'s own probe routes on an
// ephemeral port in Node and hand the page the address; the page then fetches `/version` from it like a game would.
const servers = new Map<number, import('node:http').Server>()

const versionServerStart: BrowserCommand<
  [allowedOrigin: string, facts: Record<string, unknown> | undefined],
  { id: number; url: string }
> = async (ctx, allowedOrigin, facts) => {
  const { installProbes, originPolicy } =
    await ctx.project.import<typeof import('@automata/net-server')>('@automata/net-server')
  const { createServer } = await import('node:http')
  // A listener whose own handler answers 404, as Colyseus does for the paths the probes leave.
  const http = createServer((_request, response) => response.writeHead(404).end())
  installProbes(http, {
    readiness: () => 'ready',
    version: () => facts as never,
    origins: originPolicy([allowedOrigin]),
  })
  await new Promise<void>((resolve) => http.listen(0, '127.0.0.1', resolve))
  const address = http.address()
  if (typeof address !== 'object' || address === null) throw new Error('the version server has no address')
  servers.set(address.port, http)
  return { id: address.port, url: `http://127.0.0.1:${address.port}` }
}

const versionServerStop: BrowserCommand<[id: number], void> = async (_ctx, id) => {
  const http = servers.get(id)
  servers.delete(id)
  if (http !== undefined) await new Promise((resolve) => http.close(resolve))
}

export default defineTests({
  environment: 'jsdom',
  svelte: true,
  plugins: [svelteTesting()],
  setupFiles: ['./tests/vitest-setup.ts'],
  css: true,
  browserCommands: { versionServerStart, versionServerStop } as NonNullable<TestOptions['browserCommands']>,
})
