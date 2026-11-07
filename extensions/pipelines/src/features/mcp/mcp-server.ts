import { realpathSync } from 'node:fs'
import { resolve } from 'node:path'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { Protocol } from '@modelcontextprotocol/sdk/shared/protocol.js'
import {
  type CallToolResult,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js'
import { Clock, Effect, Fiber, type ManagedRuntime } from 'effect'
import { z } from 'zod'
import { AUDIT_LOG, appendAudit, auditRootOf, gitHead } from '../../shared/audit.ts'
import { EstimateTokens } from '../../shared/estimate-token.ts'
import { EXIT } from '../../shared/exit.ts'
import type { PipelineDef, StageServices } from '../../shared/pipeline.ts'
import { type Env, redact, redactValue } from '../../shared/redact.ts'
import { PLANNED } from '../../shared/router.ts'
import { refusal, type Tool, type ToolContext, toolsFor } from './mcp-tools.ts'
import type { Answer, Asker, PersonAnswer } from './review.ts'

// The `pipelines` MCP server. It uses the SDK's
// low-level `Server` and handles tools/list and tools/call itself, so every call that reaches it, an unknown
// tool or invalid input included, leaves exactly one audit line, and a call to a tool that would decide a gate
// is refused with exit 4 and logged. Answers are JSON text; exit 0 (done) and 3 (at a gate) are answers, any
// other exit is a tool error.

export { TOOL_NAMES } from './mcp-tools.ts'

/** How long the person's review form stays open (the client's own tool timeout must allow as much). */
export const REVIEW_TIMEOUT_MS: number = 15 * 60 * 1000

export interface ServerOptions {
  /** Targets stay inside it. The audit log is beside the nearest `pipeline.toml` at or above it (audit.ts). */
  readonly root: string
  readonly pipelines: readonly PipelineDef[]
  /** Pipelines with a row but no code yet: they answer exit 2. */
  readonly planned?: readonly string[] | undefined
  /** Runs every tool's effect: core's live `Files` and `ProcessRunner` in the bin, test layers in tests. */
  readonly runtime: ManagedRuntime.ManagedRuntime<StageServices, never>
  readonly reviewTimeoutMs?: number | undefined
  /** For redaction; default `process.env`. */
  readonly env?: Env | undefined
}

const INSTRUCTIONS =
  "The project's content pipelines. Estimate before any paid run (pipeline_estimate, then pipeline_run with its " +
  'token). No tool approves or rejects a gate: pipeline_request_review asks the person. Never call a paid API or ' +
  'decide a gate through the automata-pipe command line yourself.'

/** A tool name that says it decides a gate: refused with exit 4 rather than "unknown". */
const DECIDES = /approve|reject|decide/i

const invalid = (error: z.ZodError): string =>
  `invalid input: ${error.issues
    .map((issue) => `${issue.path.length === 0 ? '(input)' : issue.path.join('.')}: ${issue.message}`)
    .join('; ')}`

/**
 * tools/call with any params. The SDK's own schema would reject a call whose name is not a string or whose arguments
 * are not an object before any handler ran, leaving no audit line; this one lets every call through to be logged and
 * answered as invalid here.
 */
const AnyToolCall = z.object({ method: z.literal('tools/call'), params: z.unknown() })

/** Runs one call: the tool, or the refusal for a malformed call, an unknown or deciding name, or invalid input. */
const answer = (
  tools: readonly Tool[],
  ctx: ToolContext,
  name: unknown,
  args: unknown,
): Effect.Effect<Answer, never, StageServices> => {
  if (typeof name !== 'string')
    return Effect.succeed(refusal(EXIT.failed, 'invalid call: the tool name must be a string'))
  if (typeof args !== 'object' || args === null || Array.isArray(args))
    return Effect.succeed(refusal(EXIT.failed, 'invalid input: the arguments must be an object'))
  const tool = tools.find((candidate) => candidate.name === name)
  if (tool === undefined)
    return Effect.succeed(
      DECIDES.test(name)
        ? refusal(
            EXIT.refused,
            'refused: no tool decides a gate; only a person does, through pipeline_request_review',
          )
        : refusal(EXIT.failed, `unknown tool ${name}`),
    )
  const parsed = tool.input.safeParse(args)
  if (!parsed.success) return Effect.succeed(refusal(EXIT.failed, invalid(parsed.error)))
  // A defect in a tool (a bug, or a stage method throwing outside the runner's own catch) is a failed call, not a
  // dropped request: the agent gets the message and the log gets the line.
  return Effect.catchAllDefect(tool.handle(ctx, parsed.data as Record<string, unknown>), (defect) =>
    Effect.succeed(refusal(EXIT.failed, defect instanceof Error ? defect.message : String(defect))),
  )
}

/** The person, through the client's elicitation form. */
const askerFor = (server: Server, timeoutMs: number): Asker => ({
  canAsk: () => server.getClientCapabilities()?.elicitation !== undefined,
  ask: (message) =>
    Effect.promise(
      (): Promise<PersonAnswer> =>
        server
          .elicitInput(
            {
              message,
              requestedSchema: {
                type: 'object',
                properties: {
                  decision: {
                    type: 'string',
                    title: 'Decision',
                    enum: ['approve', 'reject'],
                    description: 'approve lets the pipeline go on; reject makes the stage again',
                  },
                  note: { type: 'string', title: 'Note', description: 'what to keep or change' },
                },
                required: ['decision'],
              },
            },
            { timeout: timeoutMs },
          )
          .then((reply): PersonAnswer => {
            if (reply.action === 'decline') return { kind: 'undecided', why: 'declined' }
            if (reply.action === 'cancel') return { kind: 'undecided', why: 'cancelled' }
            const decision = reply.content?.decision
            const note = reply.content?.note
            if (decision !== 'approve' && decision !== 'reject')
              return { kind: 'undecided', why: 'no decision' }
            return {
              kind: 'decided',
              decision,
              note: typeof note === 'string' && note !== '' ? note : undefined,
            }
          })
          .catch((error: unknown): PersonAnswer => {
            // The SDK checks the reply against the form's schema: a reply without a decision fails that check.
            if (error instanceof McpError && error.code === ErrorCode.InvalidParams)
              return { kind: 'undecided', why: 'no decision' }
            if (error instanceof McpError && error.code === ErrorCode.RequestTimeout)
              return { kind: 'undecided', why: 'timed out' }
            return {
              kind: 'undecided',
              why: `no answer: ${error instanceof Error ? error.message : String(error)}`,
            }
          }),
    ),
})

/** Each server's tool calls still running, for `interruptCalls`. */
const inFlight = new WeakMap<Server, Set<Fiber.RuntimeFiber<CallToolResult>>>()

/**
 * Interrupts every tool call the server is running and waits for their finalizers (the locks' releases). The bin calls
 * it on SIGINT and SIGTERM before it exits.
 */
export async function interruptCalls(server: Server): Promise<void> {
  const calls = [...(inFlight.get(server) ?? [])]
  await Effect.runPromise(Fiber.interruptAll(calls))
}

/** The server, not yet connected: `server.connect(transport)` serves it. */
export function createPipelinesServer(options: ServerOptions): Server {
  const root = resolve(options.root)
  const planned = options.planned ?? PLANNED
  const env = options.env ?? process.env
  const names = [...new Set([...options.pipelines.map((def) => def.name), ...planned])]
  const tools = toolsFor(names)
  const server = new Server(
    { name: 'pipelines', version: '0.0.0' },
    { capabilities: { tools: {} }, instructions: INSTRUCTIONS },
  )
  const ctx: ToolContext = {
    root,
    realRoot: realpathSync(root),
    pipelines: options.pipelines,
    planned,
    tokens: new EstimateTokens(),
    asker: askerFor(server, options.reviewTimeoutMs ?? REVIEW_TIMEOUT_MS),
  }

  const calls = new Set<Fiber.RuntimeFiber<CallToolResult>>()
  inFlight.set(server, calls)

  server.setRequestHandler(ListToolsRequestSchema, () => ({
    tools: tools.map((tool) => {
      const { $schema: _, ...schema } = z.toJSONSchema(tool.input) as Record<string, unknown>
      return { name: tool.name, description: tool.description, inputSchema: schema as { type: 'object' } }
    }),
  }))

  // `Server.setRequestHandler` re-validates tools/call with the SDK's strict schema, so the handler is installed with
  // the base class's method, which parses only with the schema given (AnyToolCall).
  Protocol.prototype.setRequestHandler.call(server, AnyToolCall, (request): Promise<CallToolResult> => {
    const params = (typeof request.params === 'object' && request.params !== null ? request.params : {}) as {
      readonly name?: unknown
      readonly arguments?: unknown
    }
    const name = params.name
    const args = params.arguments ?? {}
    const call = Effect.gen(function* () {
      const started = yield* Clock.currentTimeMillis
      const result = yield* answer(tools, ctx, name, args)
      const ms = (yield* Clock.currentTimeMillis) - started
      const ok = result.exit === EXIT.done || result.exit === EXIT.atGate
      // Beside the located target's pipeline.toml; a call with no target (list, unknown, malformed) uses the root's.
      const auditRoot = yield* auditRootOf(result.auditFrom ?? root, root)
      const logged = yield* Effect.either(
        appendAudit(
          resolve(auditRoot, AUDIT_LOG),
          {
            at: new Date(started).toISOString(),
            tool: String(name),
            args,
            ok,
            // Redacted before the cut: a cut inside a key would leave a prefix the redaction no longer matches.
            summary: redact(result.summary, env).slice(0, 500),
            ...(result.cost === undefined ? {} : { cost: result.cost }),
            ms,
            head: yield* gitHead(auditRoot),
          },
          env,
        ),
      )
      const data = { type: 'text' as const, text: JSON.stringify(redactValue(result.data, env), null, 2) }
      // A call whose line cannot be written is not answered as if it were logged: the agent sees the failure, and
      // still sees what the call did (a run may have spent), as the second part.
      if (logged._tag === 'Left') {
        const failure = { type: 'text' as const, text: redact(`audit log: ${logged.left}`, env) }
        return { isError: true, content: [failure, data] }
      }
      return { ...(ok ? {} : { isError: true }), content: [data] }
    })
    // Forked and tracked, so a signal can interrupt it and its finalizers (the target and ledger locks) run.
    const fiber = options.runtime.runFork(call)
    calls.add(fiber)
    fiber.addObserver(() => calls.delete(fiber))
    return Effect.runPromise(Fiber.join(fiber))
  })

  return server
}
