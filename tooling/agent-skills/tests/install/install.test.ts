import { type SpawnSyncReturns, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { diffSkillTrees } from '#src/skill-tree.ts'

// DX.7's install test (spec §3.7, §8 "Plugin", §12): installs the plugin from this repo's marketplace with the real
// Claude Code CLI, and the skills with the real Agent Skills installer, then checks what landed. Everything happens
// in a throwaway CLAUDE_CONFIG_DIR and HOME, so the user's own Claude settings are never touched. Its console output
// is the install log recorded in the spec's §3.7 "As built". Run: pnpm --filter @automata/agent-skills test:install

const REPO = resolve(import.meta.dirname, '../../../..')
const PLUGIN = join(REPO, 'agents/automata')
const SKILL_NAMES = ['automata', 'automata-api', 'automata-feature', 'automata-verify']
const CLAUDE_VERSION = '2.1.301'
const SKILLS_CLI = 'skills@1.7.0'

let temp = ''
let env: NodeJS.ProcessEnv = {}

beforeAll(() => {
  temp = mkdtempSync(join(tmpdir(), 'agent-install-'))
  mkdirSync(join(temp, 'config'))
  mkdirSync(join(temp, 'home'))
  env = {
    ...process.env,
    CLAUDE_CONFIG_DIR: join(temp, 'config'),
    HOME: join(temp, 'home'),
    DISABLE_TELEMETRY: '1',
    DO_NOT_TRACK: '1',
  }
})
afterAll(() => rmSync(temp, { recursive: true, force: true }))

/** Runs a command, prints it and its output (the install log), and returns the result. */
function run(command: string, args: readonly string[], options: { cwd?: string; input?: string } = {}) {
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

describe('the Claude Code plugin', () => {
  it(`runs on Claude Code ${CLAUDE_VERSION}`, () => {
    expect(run('claude', ['--version']).stdout).toContain(CLAUDE_VERSION)
  })

  it('validates strictly, plugin and marketplace', () => {
    expect(run('claude', ['plugin', 'validate', PLUGIN, '--strict']).status).toBe(0)
    expect(run('claude', ['plugin', 'validate', REPO, '--strict']).status).toBe(0)
  })

  it("installs from this repo's marketplace", () => {
    expect(run('claude', ['plugin', 'marketplace', 'add', REPO]).status).toBe(0)
    expect(run('claude', ['plugin', 'install', 'automata@automata-framework']).status).toBe(0)
    expect(run('claude', ['plugin', 'list']).output).toMatch(/automata@automata-framework[\s\S]*enabled/)
  })

  it('loads the four skills and both hooks', () => {
    const details = run('claude', ['plugin', 'details', 'automata@automata-framework']).output
    expect(details).toMatch(/Skills \(4\)/)
    for (const name of SKILL_NAMES) expect(details).toContain(name)
    expect(details).toMatch(/Hooks \(2\)\s+PostToolUse, Stop/)
  })

  it('installs the skills byte for byte', () => {
    expect(diffSkillTrees(join(PLUGIN, 'skills'), join(installPath(), 'skills'))).toEqual([])
  })

  it("blocks a sim edit that imports effect, through the installed hook, in the reference game's own check", () => {
    const game = join(REPO, 'games/emberwick')
    const seeded = join(game, 'src/sim/dx7-seeded.system.ts')
    const hook = join(installPath(), 'scripts/check.mjs')
    const event = (file: string) =>
      JSON.stringify({
        hook_event_name: 'PostToolUse',
        tool_name: 'Write',
        cwd: game,
        tool_input: { file_path: file },
      })
    const previous = env.CLAUDE_PROJECT_DIR
    env.CLAUDE_PROJECT_DIR = game
    try {
      const clean = run('node', [hook, 'post-edit'], { input: event(join(game, 'src/sim/goal.system.ts')) })
      expect(clean.status).toBe(0)

      writeFileSync(seeded, "import { Effect } from 'effect'\n\nexport const seeded = Effect.succeed(1)\n")
      const blocked = run('node', [hook, 'post-edit'], { input: event(seeded) })
      expect(blocked.status).toBe(2)
      expect(blocked.stderr).toContain('automata check --sim-only --json found problems')
      expect(blocked.stderr).toMatch(/"file":"src\/sim\/dx7-seeded\.system\.ts"[^}]*"rule":"import"/)
    } finally {
      rmSync(seeded, { force: true })
      env.CLAUDE_PROJECT_DIR = previous
    }
  })
})

/** Where Claude Code copied the installed plugin (its own record, installed_plugins.json). */
function installPath(): string {
  const record = JSON.parse(readFileSync(join(temp, 'config/plugins/installed_plugins.json'), 'utf8')) as {
    plugins: Record<string, Array<{ installPath: string }>>
  }
  const path = record.plugins['automata@automata-framework']?.[0]?.installPath
  if (path === undefined) throw new Error('automata@automata-framework is not installed')
  return path
}

describe('the Agent Skills install (npx skills add)', () => {
  it('installs the four skills for Claude Code, Codex and Cursor, byte for byte', () => {
    const project = join(temp, 'project')
    mkdirSync(project)
    writeFileSync(join(project, 'package.json'), '{ "private": true }\n')
    const listed = run('npx', ['-y', SKILLS_CLI, 'add', PLUGIN, '--list'], { cwd: project })
    expect(listed.status).toBe(0)
    for (const name of SKILL_NAMES) expect(listed.output).toContain(name)

    const added = run(
      'npx',
      [
        '-y',
        SKILLS_CLI,
        'add',
        PLUGIN,
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
      for (const name of SKILL_NAMES) {
        expect(
          diffSkillTrees(join(PLUGIN, 'skills', name), join(project, folder, name)),
          `${folder}/${name}`,
        ).toEqual([])
      }
    }
  })
})
