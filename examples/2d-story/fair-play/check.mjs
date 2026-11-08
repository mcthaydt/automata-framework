import { fileURLToPath } from 'node:url'
import { createServer, createServerModuleRunner } from 'vite'

// The command behind the `fair-play` check in content/editors.toml. The story's sim is TypeScript that reads the
// level and the guard's files through the content plugin, so it runs in Vite's module runner, with the game's own
// vite.config.ts, the way `pnpm dev` loads it. It prints `{ measure }` for the editor and exits 0 either way: whether the
// guard is fair is the measure's `ok`, not the command's success.

const root = fileURLToPath(new URL('..', import.meta.url))
const server = await createServer({
  root,
  configLoader: 'runner',
  logLevel: 'error',
  appType: 'custom',
  server: { middlewareMode: true, ws: false, watch: null },
  optimizeDeps: { noDiscovery: true, include: [] },
  // The workspace's own packages are TypeScript sources: Vite transforms them rather than leaving them to Node.
  ssr: { noExternal: [/^@automata\//] },
})
try {
  const runner = createServerModuleRunner(server.environments.ssr)
  const { check } = await runner.import('/fair-play/run.ts')
  process.stdout.write(`${JSON.stringify(await check())}\n`)
} finally {
  await server.close()
}
