// The root README's commands: every line of its `sh` blocks must name a root script, a
// workspace package's script or a file that exists, so the README cannot drift from the repository. The
// readme test and consumer smoke both run this check.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { workspacePackages } from '../../release/src/publishable-packages.ts'

export interface Workspace {
  readonly rootScripts: ReadonlySet<string>
  /** Workspace package name -> its script names. */
  readonly packageScripts: ReadonlyMap<string, ReadonlySet<string>>
  readonly fileExists: (path: string) => boolean
}

interface ScriptsManifest {
  readonly scripts?: Readonly<Record<string, string>>
}

/** The scripts and packages the README's commands may name, read from the repository at `root`. */
export function readWorkspace(root: string): Workspace {
  const rootManifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as ScriptsManifest
  const packageScripts = new Map<string, ReadonlySet<string>>()
  for (const { manifest } of workspacePackages(root)) {
    const scripts = (manifest as ScriptsManifest).scripts ?? {}
    packageScripts.set(manifest.name, new Set(Object.keys(scripts)))
  }
  return {
    rootScripts: new Set(Object.keys(rootManifest.scripts ?? {})),
    packageScripts,
    fileExists: (path) => existsSync(join(root, path)),
  }
}

/** Every command in the markdown's ```sh blocks: one per line and per `&&`, without `#` comments. */
export function readmeCommands(markdown: string): string[] {
  const commands: string[] = []
  let inShell = false
  for (const line of markdown.split('\n')) {
    const fence = /^```(\S*)/.exec(line.trim())
    if (fence !== null) {
      inShell = !inShell && fence[1] === 'sh'
      continue
    }
    if (!inShell) continue
    const code = line.replace(/(^|\s)#.*$/, '').trim()
    if (code === '') continue
    for (const part of code.split('&&')) commands.push(part.trim())
  }
  return commands
}

/** Why one command does not resolve, or undefined when it does. */
function problemWith(command: string, workspace: Workspace): string | undefined {
  const words = command.split(/\s+/)
  const [tool, first, second, third] = words
  if (tool === 'git' && first === 'clone') return undefined
  if (tool === 'cd' || (tool === 'corepack' && first === 'enable')) return undefined
  if (tool === 'node' && first !== undefined) {
    return workspace.fileExists(first) ? undefined : `${first} does not exist`
  }
  if (tool === 'pnpm' && first === 'install') return undefined
  if (tool === 'pnpm' && first === '--filter' && second !== undefined && third !== undefined) {
    const scripts = workspace.packageScripts.get(second)
    if (scripts === undefined) return `no workspace package is named "${second}"`
    return scripts.has(third) ? undefined : `${second} has no "${third}" script`
  }
  if (tool === 'pnpm' && first !== undefined) {
    return workspace.rootScripts.has(first) ? undefined : `the root package.json has no "${first}" script`
  }
  return 'not a command this check knows (git clone, cd, corepack enable, pnpm, node)'
}

/** One line per command that does not resolve, as `<command>: <why>`. */
export function unresolvedCommands(commands: readonly string[], workspace: Workspace): string[] {
  return commands.flatMap((command) => {
    const problem = problemWith(command, workspace)
    return problem === undefined ? [] : [`${command}: ${problem}`]
  })
}
