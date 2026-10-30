import { resolve } from 'node:path'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import {
  CallToolRequestSchema,
  type CallToolResult,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js'
import { Clock, Effect, type ManagedRuntime } from 'effect'
import { z } from 'zod'
import { AUDIT_LOG, appendAudit, gitHead } from './audit.ts'
import { EstimateTokens } from './estimate-token.ts'
import { EXIT } from './exit.ts'
import { refusal, type Tool, type ToolContext, toolsFor } from './mcp-tools.ts'
import type { PipelineDef, StageServices } from './pipeline.ts'
import { type Env, redact, redactValue } from './redact.ts'
import type { Answer, Asker, PersonAnswer } from './review.ts'
import { PLANNED } from './router.ts'

// The `pipelines` MCP server (M3 spec §4.8; The Last Light's scripts/mcp/tools.ts at 92e6704). It uses the SDK's
// low-level `Server` and handles tools/list and tools/call itself (plan D3), so every call that reaches it, an unknown
// tool or invalid input included, leaves exactly one audit line (PL-c), and a call to a tool that would decide a gate
// is refused with exit 4 and logged (PL-d). Answers are JSON text; exit 0 (done) and 3 (at a gate) are answers, any
// other exit is a tool error.

export { TOOL_NAMES } from './mcp-tools.ts'

/** How long the person's review form stays open (the client's own tool timeout must allow as much). */
export const REVIEW_TIMEOUT_MS: number = 15 * 60 * 1000

export interface ServerOptions {
  /** The project root: targets stay inside it, `git rev-parse HEAD` runs in it, and the audit log is under it. */
  readonly root: string
  readonly pipelines: readonly PipelineDef[]
  /** Pipelines with a row but no code yet: they answer exit 2. */
  readonly planned?: readonly string[] | undefined
  /** Runs every tool's effect: core's live `Files` and `ProcessRunner` in the bin, test layers in tests. */
  readonly runtime: ManagedRuntime.ManagedRuntime<StageServices, never>
  /** Default `<root>/docs/pipeline-audit.jsonl`. */
  readonly auditPath?: string | undefined
  readonly reviewTimeoutMs?: number | undefined
  /** For redaction; default `process.env`. */
  readonly env?: Env | undefined
}

const INSTRUCTIONS =
  "The project's content pipelines. Estimate before any paid run (pipeline_estimate, then pipeline_run with its " +
  'token). No tool approves or rejects a gate: pipeline_request_review asks the person. Never call a paid API or ' +
  'decide a gate through the automata-pipe command line yourself.'

/** A tool name that says it decides a gate: refused with exit 4 rather than "unknown" (PL-d). */
const DECIDES = /approve|reject|decide/i

const invalid = (error: z.ZodError): string =>
  `invalid input: ${error.issues
    .map((issue) => `${issue.path.length === 0 ? '(input)' : issue.path.join('.')}: ${issue.message}`)
    .join('; ')}`

/** Runs one call: the tool, or the refusal for an unknown or deciding name, or for invalid input. */
const answer = (
  tools: readonly Tool[],
  ctx: ToolContext,
  name: string,
  args: Record<string, unknown>,
): Effect.Effect<Answer, never, StageServices> => {
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

/** The person, through the client's elicitation form (plan D8 for the outcomes). */
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

/** The server, not yet connected: `server.connect(transport)` serves it. */
export function createPipelinesServer(options: ServerOptions): Server {
  const root = resolve(options.root)
  const planned = options.planned ?? PLANNED
  const env = options.env ?? process.env
  const auditPath = options.auditPath ?? resolve(root, AUDIT_LOG)
  const names = [...new Set([...options.pipelines.map((def) => def.name), ...planned])]
  const tools = toolsFor(names)
  const server = new Server(
    { name: 'pipelines', version: '0.0.0' },
    { capabilities: { tools: {} }, instructions: INSTRUCTIONS },
  )
  const ctx: ToolContext = {
    root,
    pipelines: options.pipelines,
    planned,
    tokens: new EstimateTokens(),
    asker: askerFor(server, options.reviewTimeoutMs ?? REVIEW_TIMEOUT_MS),
  }

  server.setRequestHandler(ListToolsRequestSchema, () => ({
    tools: tools.map((tool) => {
      const { $schema: _, ...schema } = z.toJSONSchema(tool.input) as Record<string, unknown>
      return { name: tool.name, description: tool.description, inputSchema: schema as { type: 'object' } }
    }),
  }))

  server.setRequestHandler(CallToolRequestSchema, (request): Promise<CallToolResult> => {
    const name = request.params.name
    const args = request.params.arguments ?? {}
    const call = Effect.gen(function* () {
      const started = yield* Clock.currentTimeMillis
      const result = yield* answer(tools, ctx, name, args)
      const ms = (yield* Clock.currentTimeMillis) - started
      const ok = result.exit === EXIT.done || result.exit === EXIT.atGate
      const logged = yield* Effect.either(
        appendAudit(
          auditPath,
          {
            at: new Date(started).toISOString(),
            tool: name,
            args,
            ok,
            summary: result.summary.slice(0, 500),
            ...(result.cost === undefined ? {} : { cost: result.cost }),
            ms,
            head: yield* gitHead(root),
          },
          env,
        ),
      )
      // A call whose line cannot be written is not answered as if it were logged: the agent sees the failure.
      if (logged._tag === 'Left')
        return {
          isError: true,
          content: [{ type: 'text' as const, text: redact(`audit log: ${logged.left}`, env) }],
        }
      return {
        ...(ok ? {} : { isError: true }),
        content: [{ type: 'text' as const, text: JSON.stringify(redactValue(result.data, env), null, 2) }],
      }
    })
    return options.runtime.runPromise(call)
  })

  return server
}
