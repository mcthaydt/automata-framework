import { type SpawnSyncReturns, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { readAgentPackage } from '#src/layout.ts'
import { writeMirror } from '#src/mirror.ts'
import { diffSkillTrees } from '#src/skill-tree.ts'
// The consumer smoke's helpers are the ones that make a stranger's folder and say where the packs are, so this suite
// meets the same game a stranger meets (the relative cross-tooling import the repo already uses).
import { packAll, sh } from '../../../consumer-smoke/src/commands.ts'
import { overridesYaml, packOverrides, strangerFolder } from '../../../consumer-smoke/src/stranger.ts'

// The install suite (spec section 5): installs the plugin with the real Claude Code CLI from the framework's
// marketplace and from the public mirror (the tree the release job pushes, written by the same generator), and the
// skills with the real Agent Skills installer, then checks what landed. Everything happens in throwaway CLAUDE_CONFIG_DIR
// and HOME folders, so the user's own Claude settings are never touched. Its console output is the install log.
// Needs the `claude` CLI on PATH, the npm registry, and packages built by `pnpm build` (the stranger's game is made from
// their packs). It runs in the release checks after the consumer smoke; never in `pnpm check`.
// Run: pnpm --filter @automata/agent-skills test:install

const REPO = resolve(import.meta.dirname, '../../../..')
const PLUGIN = join(REPO, 'agents/automata')
const SKILLS_CLI = 'skills@1.7.0'
// The one place the Claude Code version is written is the root `plugin:validate` script.
const rootScripts = (
  JSON.parse(readFileSync(join(REPO, 'package.json'), 'utf8')) as { scripts: Record<string, string> }
).scripts
const CLAUDE_VERSION =
  /@anthropic-ai\/claude-code@(\d+\.\d+\.\d+)/.exec(rootScripts['plugin:validate'] ?? '')?.[1] ?? ''
// Never typed by hand: the package has as many skills as it has folders.
const SKILL_NAMES = readAgentPackage(REPO).skills.map((skill) => skill.name)

const temp = mkdtempSync(join(tmpdir(), 'agent-install-'))
const mirror = join(temp, 'automata-skills')
afterAll(() => rmSync(temp, { recursive: true, force: true }))

/** Runs a command, prints it and its output (the install log), and returns the result. */
function run(
  env: NodeJS.ProcessEnv,
  command: string,
  args: readonly string[],
  options: { cwd?: string; input?: string } = {},
) {
  const result: SpawnSyncReturns<string> = spawnSync(command, args, {
    cwd: options.cwd ?? REPO,
    env,
    input: options.input,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`
  console.log(`$ ${[command, ...args].join(' ')}\n${output.trim()}\n(exit ${result.status})\n`)
  return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '', output }
}

/** An environment with its own Claude config and HOME, so each source installs into a clean place. */
function isolatedEnv(name: string): NodeJS.ProcessEnv {
  mkdirSync(join(temp, 'env', name, 'config'), { recursive: true })
  mkdirSync(join(temp, 'env', name, 'home'), { recursive: true })
  return {
    ...process.env,
    CLAUDE_CONFIG_DIR: join(temp, 'env', name, 'config'),
    HOME: join(temp, 'env', name, 'home'),
    DISABLE_TELEMETRY: '1',
    DO_NOT_TRACK: '1',
  }
}

beforeAll(() => {
  writeMirror({ repo: REPO, out: mirror })
})

describe('Claude Code', () => {
  const env = isolatedEnv('validate')

  it(`runs on Claude Code ${CLAUDE_VERSION}`, () => {
    expect(CLAUDE_VERSION).not.toBe('')
    expect(run(env, 'claude', ['--version']).stdout).toContain(CLAUDE_VERSION)
  })

  it('validates strictly: the plugin, the framework marketplace and the mirror', () => {
    for (const path of [PLUGIN, REPO, mirror])
      expect(run(env, 'claude', ['plugin', 'validate', path, '--strict']).status, path).toBe(0)
  })
})

/** The two places a person can install from: this repository's marketplace, and the mirror the release job pushes. */
const SOURCES = [
  { name: 'automata-framework', dir: REPO },
  { name: 'automata-skills', dir: mirror },
] as const

/** Where Claude Code copied the installed plugin (its own record, installed_plugins.json). */
function installPath(env: NodeJS.ProcessEnv, marketplace: string): string {
  const record = JSON.parse(
    readFileSync(join(env.CLAUDE_CONFIG_DIR ?? '', 'plugins/installed_plugins.json'), 'utf8'),
  ) as {
    plugins: Record<string, Array<{ installPath: string }>>
  }
  const path = record.plugins[`automata@${marketplace}`]?.[0]?.installPath
  if (path === undefined) throw new Error(`automata@${marketplace} is not installed`)
  return path
}

describe.each(SOURCES)('the plugin installed from the $name marketplace', ({ name, dir }) => {
  const env = isolatedEnv(name)

  it(`installs from the ${name} marketplace`, () => {
    expect(run(env, 'claude', ['plugin', 'marketplace', 'add', dir]).status).toBe(0)
    expect(run(env, 'claude', ['plugin', 'install', `automata@${name}`]).status).toBe(0)
    expect(run(env, 'claude', ['plugin', 'list']).output).toMatch(
      new RegExp(`automata@${name}[\\s\\S]*enabled`),
    )
  })

  it(`loads ${SKILL_NAMES.length} skills and both hooks`, () => {
    const details = run(env, 'claude', ['plugin', 'details', `automata@${name}`]).output
    expect(details).toContain(`Skills (${SKILL_NAMES.length})`)
    for (const skill of SKILL_NAMES) expect(details).toContain(skill)
    expect(details).toMatch(/Hooks \(2\)\s+PostToolUse, Stop/)
  })

  it('installs the skills byte for byte', () => {
    expect(diffSkillTrees(join(PLUGIN, 'skills'), join(installPath(env, name), 'skills'))).toEqual([])
  })
})

describe('the installed hook, in a game a stranger made', () => {
  // The hook that ships is the mirror's. The game is what `create-game` writes, installed from the packs outside any
  // pnpm workspace, the way the consumer smoke's stranger makes it.
  let folder = ''
  let gameDir = ''
  const env = isolatedEnv('hook')

  beforeAll(() => {
    folder = strangerFolder()
    gameDir = join(folder, 'work', 'my-game')
    const packs = packAll(REPO, folder)
    const overrides = packOverrides(folder, packs)
    const toolsDir = join(folder, 'tools')
    mkdirSync(toolsDir, { recursive: true })
    writeFileSync(
      join(toolsDir, 'package.json'),
      JSON.stringify({ name: 'stranger-tools', private: true, type: 'module' }),
    )
    writeFileSync(join(toolsDir, 'pnpm-workspace.yaml'), overridesYaml(overrides))
    sh(toolsDir, 'pnpm', ['add', overrides['@automata/tools'] as string])
    mkdirSync(join(folder, 'work'), { recursive: true })
    sh(join(folder, 'work'), join(toolsDir, 'node_modules/.bin/automata'), ['create-game', 'my-game'])
    writeFileSync(join(gameDir, 'pnpm-workspace.yaml'), overridesYaml(overrides))
    sh(gameDir, 'pnpm', ['install', '--no-frozen-lockfile'])
    expect(run(env, 'claude', ['plugin', 'marketplace', 'add', mirror]).status).toBe(0)
    expect(run(env, 'claude', ['plugin', 'install', 'automata@automata-skills']).status).toBe(0)
  })
  afterAll(() => rmSync(folder, { recursive: true, force: true }))

  it('blocks a sim edit that imports effect, and passes a clean one', () => {
    const hook = join(installPath(env, 'automata-skills'), 'scripts/check.mjs')
    const feature = join(gameDir, 'src/features/square')
    const seeded = join(feature, 'seeded.system.ts')
    const event = (file: string) =>
      JSON.stringify({
        hook_event_name: 'PostToolUse',
        tool_name: 'Write',
        cwd: gameDir,
        tool_input: { file_path: file },
      })
    const hookEnv = { ...env, CLAUDE_PROJECT_DIR: gameDir }

    const clean = run(hookEnv, 'node', [hook, 'post-edit'], { input: event(join(feature, 'move.system.ts')) })
    expect(clean.status).toBe(0)

    writeFileSync(seeded, "import { Effect } from 'effect'\n\nexport const seeded = Effect.succeed(1)\n")
    const blocked = run(hookEnv, 'node', [hook, 'post-edit'], { input: event(seeded) })
    expect(blocked.status).toBe(2)
    expect(blocked.stderr).toContain('automata check --sim-only --json found problems')
    expect(blocked.stderr).toMatch(/"file":"src\/features\/square\/seeded\.system\.ts"[^}]*"rule":"import"/)
  })
})

describe('the Agent Skills install (npx skills add)', () => {
  it('installs the skills for Claude Code, Codex and Cursor with the Agent Skills installer, byte for byte', () => {
    const env = isolatedEnv('skills')
    const project = join(temp, 'project')
    mkdirSync(project)
    writeFileSync(join(project, 'package.json'), '{ "private": true }\n')
    const listed = run(env, 'npx', ['-y', SKILLS_CLI, 'add', mirror, '--list'], { cwd: project })
    expect(listed.status).toBe(0)
    for (const skill of SKILL_NAMES) expect(listed.output).toContain(skill)

    const added = run(
      env,
      'npx',
      [
        '-y',
        SKILLS_CLI,
        'add',
        mirror,
        '--agent',
        'claude-code',
        'codex',
        'cursor',
        '--skill',
        '*',
        '-y',
        '--copy',
      ],
      { cwd: project },
    )
    expect(added.status).toBe(0)
    // Claude Code reads .claude/skills/; Codex and Cursor read .agents/skills/.
    for (const folder of ['.claude/skills', '.agents/skills']) {
      for (const skill of SKILL_NAMES) {
        expect(
          diffSkillTrees(join(PLUGIN, 'skills', skill), join(project, folder, skill)),
          `${folder}/${skill}`,
        ).toEqual([])
      }
    }
  })
})
