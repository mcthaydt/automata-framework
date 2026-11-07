import { resolve } from 'node:path'
import { Clock, Effect } from 'effect'
import { AUDIT_LOG, appendAudit, auditRootOf, gitHead } from './audit.ts'
import { parseBudgetOption } from './budget.ts'
import { EXIT, type PipelineExit } from './exit.ts'
import type { PipelineDef, StageServices } from './pipeline.ts'
import type { Env } from './redact.ts'
import { COMMANDS, type Command, type RunOptions, runPipeline } from './runner.ts'
import type { PipelineResult } from './state.schema.ts'

// The router: `automata-pipe <pipeline> <command> <target> [gate]
// [options] [--json]`. It never prompts: nothing here reads stdin. With --json, stdout is exactly one JSON object
// whatever happens; without it, people read lines on stdout and the error on stderr. The framework CLI's
// `automata pipe` delegates here.

/** Pipelines with a row but no code yet: naming one exits 2 rather than 1. */
export const PLANNED: readonly string[] = ['character', 'props']

/** What the bin prints and exits with. */
export interface RouterOutput {
  readonly exit: PipelineExit
  readonly stdout: string
  readonly stderr: string
}

/** Who runs the command. An agent may not decide a gate. */
export interface Caller {
  readonly agent: boolean
  /** For redacting the audit line; the process environment in the bin. */
  readonly env?: Env | undefined
}

/** A person at their own terminal: the default, and what tests of the people's commands use. */
export const PERSON: Caller = { agent: false }

/** The message an agent's approve or reject gets. */
export const AGENT_REFUSAL =
  'refused: only a person decides a gate; an agent asks with pipeline_request_review (MCP)'

/** A refusal before any pipeline runs: the base of the result. */
interface Early {
  readonly ok: false
  readonly pipeline: string
  readonly command: string
  readonly exit: PipelineExit
  readonly error: string
}

const VALUED = new Set(['--from', '--to', '--only', '--budget', '--note', '--config'])
const FLAGS = new Set(['--force', '--paid'])

interface Parsed {
  readonly options: Omit<RunOptions, 'command' | 'target'>
  readonly positional: readonly string[]
}

/** Splits the options from the positionals. Throws with the message for exit 1. */
function parseOptions(argv: readonly string[]): Parsed {
  const values: Record<string, string> = {}
  const flags = new Set<string>()
  const positional: string[] = []
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] as string
    if (!arg.startsWith('--')) {
      positional.push(arg)
      continue
    }
    const eq = arg.indexOf('=')
    const flag = eq === -1 ? arg : arg.slice(0, eq)
    const inline = eq === -1 ? undefined : arg.slice(eq + 1)
    if (FLAGS.has(flag) && inline === undefined) flags.add(flag)
    else if (VALUED.has(flag)) {
      const value = inline ?? argv[++i]
      if (value === undefined || value === '') throw new Error(`${flag} needs a value`)
      values[flag] = value
    } else throw new Error(`unknown option ${flag}`)
  }
  const budget = values['--budget']
  return {
    positional,
    options: {
      from: values['--from'],
      to: values['--to'],
      only: values['--only']?.split(',').filter((id) => id !== ''),
      force: flags.has('--force'),
      paid: flags.has('--paid'),
      budget: budget === undefined ? undefined : parseBudgetOption(budget),
      note: values['--note'],
      config: values['--config'],
    },
  }
}

function help(pipelines: readonly PipelineDef[], planned: readonly string[]): string {
  const lines = [
    'usage: automata-pipe <pipeline> <command> <target> [gate] [options] [--json]',
    '',
    `commands: ${COMMANDS.join(' · ')}`,
    '  approve and reject <gate> are for people.',
    '',
    'pipelines:',
  ]
  for (const def of pipelines) {
    const stages = def.stages.map((stage) => {
      const notes = [...(stage.gate === undefined ? [] : [`gate ${stage.gate}`])]
      if (stage.cost !== undefined) notes.push(stage.cost.budget)
      return notes.length === 0 ? stage.id : `${stage.id} (${notes.join(', ')})`
    })
    lines.push(`  ${def.name.padEnd(10)}${stages.join(', ')}`)
  }
  for (const name of planned.filter((name) => !pipelines.some((def) => def.name === name)))
    lines.push(`  ${name.padEnd(10)}not implemented yet`)
  lines.push(
    '',
    'options: --from S  --to S  --only S[,S]  --force  --paid  --budget key=N[,key=N]  --note "…"  --config FILE  --json',
    '  --paid lets paid stages run; budgets come from the nearest pipeline.toml.',
  )
  return `${lines.join('\n')}\n`
}

/** The lines people read without --json. */
function humanLines(result: PipelineResult): string {
  const lines = result.stages.map((row) =>
    [
      `${row.id.padEnd(12)} ${row.state}`,
      row.gate === undefined ? '' : `gate ${row.gate}`,
      row.paid ? 'paid' : '',
    ]
      .filter((part) => part !== '')
      .join('  '),
  )
  for (const gate of result.gates) lines.push(`gate ${gate.id}: ${gate.decision}`)
  if (result.estimate !== undefined) lines.push(`estimate: ${JSON.stringify(result.estimate)}`)
  if (result.data !== undefined) lines.push(JSON.stringify(result.data))
  return `${lines.join('\n')}\n`
}

const print = (json: boolean, result: PipelineResult | Early): RouterOutput => {
  if (json) return { exit: result.exit, stdout: `${JSON.stringify(result)}\n`, stderr: '' }
  const stderr = result.error === undefined ? '' : `${result.error}\n`
  return { exit: result.exit, stdout: 'stages' in result ? humanLines(result) : '', stderr }
}

const isCommand = (value: string): value is Command => (COMMANDS as readonly string[]).includes(value)

/**
 * Logs an agent's refused approve or reject in the project's audit log, and gives the exit-4 output. Nothing
 * else happens: the target is not read and `gates.json` is not touched. A log that cannot be written does not turn
 * the refusal into anything else; its error goes to stderr.
 */
const refuseAgent = (
  name: string,
  command: string,
  rest: readonly string[],
  caller: Caller,
  json: boolean,
): Effect.Effect<RouterOutput, never, StageServices> =>
  Effect.gen(function* () {
    const started = yield* Clock.currentTimeMillis
    let parsed: Parsed | undefined
    try {
      parsed = parseOptions(rest)
    } catch {
      parsed = undefined
    }
    const [target, gate] = parsed?.positional ?? rest
    const note = parsed?.options.note
    // Where the log is never depends on what the agent passes: --config is ignored here (audit.ts auditRootOf).
    const root = yield* auditRootOf(target ?? '.', process.cwd())
    const args = {
      pipeline: name,
      ...(target === undefined ? {} : { target }),
      ...(gate === undefined ? {} : { gate }),
      ...(note === undefined ? {} : { note }),
    }
    const head = yield* gitHead(root)
    const logged = yield* Effect.either(
      appendAudit(
        resolve(root, AUDIT_LOG),
        {
          at: new Date(started).toISOString(),
          tool: `automata-pipe ${command}`,
          args,
          ok: false,
          summary: AGENT_REFUSAL,
          ms: (yield* Clock.currentTimeMillis) - started,
          head,
        },
        caller.env ?? {},
      ),
    )
    const out = print(json, { ok: false, pipeline: name, command, exit: EXIT.refused, error: AGENT_REFUSAL })
    return logged._tag === 'Left' ? { ...out, stderr: `${out.stderr}audit log: ${logged.left}\n` } : out
  })

/** Routes one command line to its pipeline. It never fails: every problem is an exit code. */
export const route = (
  argv: readonly string[],
  pipelines: readonly PipelineDef[],
  planned: readonly string[] = PLANNED,
  caller: Caller = PERSON,
): Effect.Effect<RouterOutput, never, StageServices> =>
  Effect.gen(function* () {
    const json = argv.includes('--json')
    const [name, command, ...rest] = argv.filter((arg) => arg !== '--json')
    if (name === undefined || name === '--help' || name === '-h' || name === 'help')
      return { exit: EXIT.done, stdout: help(pipelines, planned), stderr: '' }
    // Before the registry is consulted: an agent's decision is refused whatever it names.
    if (caller.agent && (command === 'approve' || command === 'reject'))
      return yield* refuseAgent(name, command, rest, caller, json)
    const early = (exit: PipelineExit, error: string): RouterOutput =>
      print(json, { ok: false, pipeline: name, command: command ?? '', exit, error })
    const def = pipelines.find((candidate) => candidate.name === name)
    if (def === undefined)
      return planned.includes(name)
        ? early(EXIT.notImplemented, `${name}: not implemented`)
        : early(EXIT.failed, `unknown pipeline '${name}'; see --help`)
    const commands = COMMANDS.join(', ')
    if (command === undefined) return early(EXIT.failed, `${name} needs a command; commands: ${commands}`)
    if (!isCommand(command))
      return early(EXIT.failed, `${name} has no command '${command}'; commands: ${commands}`)
    let parsed: Parsed
    try {
      parsed = parseOptions(rest)
    } catch (error) {
      return early(EXIT.failed, error instanceof Error ? error.message : String(error))
    }
    const [target, gate, extra] = parsed.positional
    if (target === undefined) return early(EXIT.failed, `${name} ${command} needs a target`)
    if (extra !== undefined) return early(EXIT.failed, `unexpected argument ${extra}`)
    return print(json, yield* runPipeline(def, { ...parsed.options, command, target, gate }))
  })
