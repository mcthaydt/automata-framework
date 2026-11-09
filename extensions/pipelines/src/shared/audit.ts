import { appendFileSync, mkdirSync, realpathSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { Effect } from 'effect'
import { z } from 'zod'
import type { Files } from './node/files.ts'
import { ProcessRunner } from './node/process.ts'
import { findPipelineToml } from './project.ts'
import { type Env, redactValue } from './redact.ts'

// The audit log: every MCP tool
// call, and every refused `approve` or `reject` from an agent, appends one JSON line to the game's
// docs/pipeline-audit.jsonl. The game commits it, so it is the record of what agents asked the pipelines to do.

/** The log, under the project root (the folder holding `pipeline.toml`). */
export const AUDIT_LOG = 'docs/pipeline-audit.jsonl'

export interface AuditEntry {
  /** ISO time the call started, from Effect's Clock. */
  readonly at: string
  /** The MCP tool, or `automata-pipe <command>` for the router's refusal. */
  readonly tool: string
  /** The arguments as given (redacted). */
  readonly args: unknown
  /** False for a refusal, an invalid call or a failure. */
  readonly ok: boolean
  readonly summary: string
  /** Units the spend ledger grew by during the call, when it grew. */
  readonly cost?: Readonly<Record<string, number>> | undefined
  /** How long the call took, from Effect's Clock. */
  readonly ms: number
  /** `git rev-parse HEAD` in the project at the call, or `unknown` outside Git. */
  readonly head: string
}

export const auditEntrySchema: z.ZodType<AuditEntry> = z
  .object({
    at: z.string(),
    tool: z.string(),
    args: z.unknown(),
    ok: z.boolean(),
    summary: z.string(),
    cost: z.record(z.string(), z.number().int().nonnegative()).optional(),
    ms: z.number().nonnegative(),
    head: z.string(),
  })
  .strict()

/** The commit checked out in `root`, or `unknown` (not a repository, no commit yet, or no git). */
export const gitHead = (root: string): Effect.Effect<string, never, ProcessRunner> =>
  Effect.gen(function* () {
    const runner = yield* ProcessRunner
    const out = yield* Effect.either(runner.run('git', ['rev-parse', 'HEAD'], { cwd: root }))
    if (out._tag === 'Left' || out.right.exitCode !== 0) return 'unknown'
    const head = out.right.stdout.trim()
    return head === '' ? 'unknown' : head
  })

/**
 * Appends one line. `node:fs` `appendFileSync` opens the file with O_APPEND and writes the line in one call, so lines
 * from concurrent writers on a local disk never interleave; `Files` has no append. Key values and key-shaped strings are redacted first.
 */
export const appendAudit = (path: string, entry: AuditEntry, env: Env): Effect.Effect<void, string> =>
  Effect.try({
    try: () => {
      mkdirSync(dirname(path), { recursive: true })
      appendFileSync(path, `${JSON.stringify(redactValue(entry, env))}\n`)
    },
    catch: (cause) => `${path}: ${cause instanceof Error ? cause.message : String(cause)}`,
  })

/**
 * The folder the audit log lives under, the one rule both bins use: the folder of the
 * nearest `pipeline.toml` at or above the real path of `from` (the target the call is about), else `fallback` (the
 * router's working folder, the server's root). Symbolic links are resolved first, so a link an agent made from
 * another folder holding its own `pipeline.toml` cannot send the line there; and nothing a caller passes moves it
 * (the router's `--config` is not consulted, the server has no option for it). `Files` has no realpath, so `node:fs`.
 */
export const auditRootOf = (from: string, fallback: string): Effect.Effect<string, never, Files> => {
  let start = resolve(from)
  try {
    start = realpathSync(start)
  } catch {
    // Not there (a target that does not exist yet): its written path is all there is to go on.
  }
  return Effect.map(findPipelineToml(start), (toml) => (toml === undefined ? fallback : dirname(toml)))
}
