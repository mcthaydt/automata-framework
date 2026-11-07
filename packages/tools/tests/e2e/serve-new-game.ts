// The new developer's path, up to a running page: `automata create-game`, an install, `pnpm build:web` and
// `vite preview`. Started by playwright.config.ts as the journey's web server; it keeps running until the run ends.
//
// The game is scaffolded into this run's own scratch folder. Its package.json asks for the workspace's packages
// (`workspace:*`), which `pnpm install` links inside the workspace; a scratch folder is not a workspace package,
// and installing there would rewrite the lockfile, so the links are made here by hand: AF's packages point at the
// workspace's, and every other dependency at the copy a workspace package installed (the same pinned versions).
import { execFileSync, spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, realpathSync, rmSync, symlinkSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { newGamePort } from './origin.ts'

const toolsDir = new URL('../..', import.meta.url).pathname
const repoRoot = join(toolsDir, '../..')
const scratch = join(toolsDir, 'tests/e2e/.scratch')
const gameDir = join(scratch, 'my-game')
const workspace: Record<string, string> = {
  '@mcthaydt/automata': join(repoRoot, 'packages/automata'),
  '@mcthaydt/automata-sim': join(repoRoot, 'packages/sim'),
  '@mcthaydt/automata-tools': toolsDir,
}
// Where the other dependencies are found: Emberwick has the game's, the root and this package the tools'.
const installedIn = ['games/emberwick', '.', 'packages/tools'].map((dir) =>
  join(repoRoot, dir, 'node_modules'),
)
const installed = (name: string): string => {
  const found = installedIn.map((dir) => join(dir, name)).find((path) => existsSync(path))
  if (found === undefined)
    throw new Error(`${name}: no workspace package installed it, so there is nothing to link`)
  return realpathSync(found)
}

rmSync(scratch, { recursive: true, force: true })
mkdirSync(scratch, { recursive: true })
const run = (command: string, args: readonly string[], cwd: string) =>
  execFileSync(command, args, { cwd, stdio: 'inherit' })

// The built bin, the one a developer installs (`pnpm build` first).
run(process.execPath, [join(toolsDir, 'dist/bin.js'), 'create-game', 'my-game', '--targets', 'web'], scratch)

const manifest = JSON.parse(readFileSync(join(gameDir, 'package.json'), 'utf8')) as {
  dependencies: Record<string, string>
  devDependencies: Record<string, string>
}
for (const name of Object.keys({ ...manifest.dependencies, ...manifest.devDependencies }).sort()) {
  const source = workspace[name] ?? installed(name)
  const link = join(gameDir, 'node_modules', name)
  mkdirSync(dirname(link), { recursive: true })
  symlinkSync(source, link, 'dir')
}

const vite = join(gameDir, 'node_modules/vite/bin/vite.js')
run(process.execPath, [vite, 'build', '--mode', 'web'], gameDir)
const preview = spawn(
  process.execPath,
  [vite, 'preview', '--strictPort', '--host', 'localhost', '--port', String(newGamePort)],
  { cwd: gameDir, stdio: 'inherit' },
)
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => preview.kill(signal))
preview.on('exit', (code) => process.exit(code ?? 0))
