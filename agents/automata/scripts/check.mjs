#!/usr/bin/env node
// The Automata plugin's hook (DX spec §3.7). Claude Code runs it with the hook event as JSON on stdin:
//   post-edit (PostToolUse on Edit|Write): after an edit to a sim file, runs `automata check --sim-only --json`.
//   stop (Stop): before the turn ends, runs the full `automata check --json`.
// Exit 0 says nothing. Exit 2 is Claude Code's blocking feedback: stderr goes back to the model, which then fixes
// the findings (after an edit) or keeps working instead of ending the turn (on stop). The hook never edits files.
// It is plain Node so it needs neither jq nor bash, and runs wherever the game's own Node does.
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'

const BLOCK = 2
// The suffixes that make a file sim code in a game laid out by feature, and the role files of the one game still laid
// out by role (the base 3D game). Copies of check-boundaries' SIM_SUFFIXES and GAME_SIM_ROLES: this hook runs with no
// dependencies; hook.test.ts pins the names.
const SIM_SUFFIXES = ['.component.ts', '.system.ts', '.command.ts', '.event.ts', '.resource.ts', '.plugin.ts']
const SIM_ROLES = ['constants', 'components', 'commands', 'events', 'resources', 'systems', 'state']
const mode = process.argv[2]
const event = readEvent()
// biome-ignore lint/suspicious/noUndeclaredEnvVars: Claude Code sets it for the hook; no turbo task reads it
const projectDir = resolve(process.env.CLAUDE_PROJECT_DIR || event.cwd || process.cwd())

if (mode === 'post-edit') {
  if (!isSimFile(event.tool_input?.file_path)) process.exit(0)
  runCheck(['check', '--sim-only', '--json'])
} else if (mode === 'stop') {
  // Claude is already continuing because this hook blocked once. Blocking again could loop forever on a finding
  // the agent cannot fix, so the second stop goes through; sim edits are still checked one by one.
  if (event.stop_hook_active === true) process.exit(0)
  runCheck(['check', '--json'])
} else {
  process.stderr.write(`automata hook: unknown mode "${mode}" (expected post-edit or stop)\n`)
  process.exit(BLOCK)
}

function readEvent() {
  try {
    const text = readFileSync(0, 'utf8')
    return text.trim() === '' ? {} : JSON.parse(text)
  } catch {
    return {}
  }
}

/**
 * True for a sim file (absolute, or relative to the project): a file under src/ whose name ends in a sim role suffix,
 * or, laid out by role, src/<role>.ts or anything under src/<role>/. A helper that a system imports is sim code too,
 * but telling needs the imports read: the stop hook's full check covers it.
 */
function isSimFile(filePath) {
  if (typeof filePath !== 'string' || filePath === '') return false
  const absolute = isAbsolute(filePath) ? filePath : join(projectDir, filePath)
  const path = relative(projectDir, absolute).split('\\').join('/')
  if (!path.startsWith('src/')) return false
  if (SIM_SUFFIXES.some((suffix) => path.endsWith(suffix))) return true
  return SIM_ROLES.some((role) => path === `src/${role}.ts` || path.startsWith(`src/${role}/`))
}

/** The project's own `automata` bin, from the project folder upwards (a game inside a workspace). */
function findAutomata() {
  const names = process.platform === 'win32' ? ['automata.cmd', 'automata'] : ['automata']
  for (let dir = projectDir; ; dir = dirname(dir)) {
    for (const name of names) {
      const bin = join(dir, 'node_modules', '.bin', name)
      if (existsSync(bin)) return bin
    }
    if (dirname(dir) === dir) return undefined
  }
}

/** Whether the project's package.json depends on any @automataframework/automata-* package. */
function isAutomataGame() {
  try {
    const pkg = JSON.parse(readFileSync(join(projectDir, 'package.json'), 'utf8'))
    const names = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies })
    return names.some((name) => name.startsWith('@automataframework/automata-'))
  } catch {
    return false
  }
}

function runCheck(args) {
  const command = `automata ${args.join(' ')}`
  const bin = findAutomata()
  if (bin === undefined) {
    // Not an Automata game (the plugin was installed for every project): nothing to check.
    if (!isAutomataGame()) process.exit(0)
    process.stderr.write(
      `${command} could not run: this game has no automata bin. Add @automataframework/automata-tools as a dev dependency ` +
        '(pnpm add -D @automataframework/automata-tools), install, and try again.\n',
    )
    process.exit(BLOCK)
  }
  const result = spawnSync(bin, args, {
    cwd: projectDir,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    shell: process.platform === 'win32',
  })
  if (result.status === 0) process.exit(0)
  const report = (result.stdout ?? '').trim()
  const what =
    result.status === 1
      ? `${command} found problems. Fix each finding, then the check runs again.`
      : `${command} could not run (exit ${result.status ?? result.signal ?? result.error?.message}). Fix the setup it names.`
  const detail = report !== '' ? report : tail(`${result.stderr ?? ''}${result.error?.message ?? ''}`)
  process.stderr.write(`${what} The automata-verify skill explains each rule.\n${detail}\n`)
  process.exit(BLOCK)
}

function tail(text) {
  const lines = text.trim().split('\n')
  return lines.slice(-40).join('\n')
}
