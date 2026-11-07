import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { ElicitRequestSchema, type ElicitResult } from '@modelcontextprotocol/sdk/types.js'
import { Layer, ManagedRuntime } from 'effect'
import { createPipelinesServer } from '../features/mcp/mcp-server.ts'
import { AUDIT_LOG, type AuditEntry } from '../shared/audit.ts'
import { gateFileSchema } from '../shared/gates-file.ts'
import { FilesLive } from '../shared/node/files.ts'
import { ProcessRunnerLive } from '../shared/node/process.ts'
import type { StageServices } from '../shared/pipeline.ts'
import { runPipeline } from '../shared/runner.ts'
import type { GateRecord } from '../shared/state.schema.ts'
import { toyPipeline } from './toy.ts'

// A project folder holding the toy pipeline's target (`toy/`, gate T1, a paid stage of one image), the server over
// the SDK's in-memory transport, and a client that answers elicitation as a test says the person would.

export type Answer = (message: string) => ElicitResult | Promise<ElicitResult>

export interface McpProject {
  readonly root: string
  readonly runtime: ManagedRuntime.ManagedRuntime<StageServices, never>
  readonly client: Client
  /** Calls a tool; `data` is its text parsed as JSON. */
  readonly call: (
    name: string,
    args?: Record<string, unknown>,
  ) => Promise<{ readonly error: boolean; readonly text: string; readonly data: Record<string, unknown> }>
  /** The person at their own terminal: the runner's approve, outside the server. */
  readonly personApproves: (gate: string) => Promise<number>
  readonly auditLines: () => AuditEntry[]
  readonly gates: () => Record<string, GateRecord>
  /** The messages the person was shown. */
  readonly prompts: string[]
}

export interface McpProjectOptions {
  readonly answer?: Answer
  readonly reviewTimeoutMs?: number
  readonly layer?: Layer.Layer<StageServices>
  readonly env?: Readonly<Record<string, string>>
  /** Runs in the folder before the server starts (a test makes it a Git repository). */
  readonly prepare?: (root: string) => void
}

export const TOY = { pipeline: 'toy', target: 'toy' } as const

export async function mcpProject(temps: string[], options: McpProjectOptions = {}): Promise<McpProject> {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'pipe-mcp-')))
  temps.push(root)
  mkdirSync(join(root, 'toy'))
  writeFileSync(join(root, 'toy/src.txt'), 'source\n')
  writeFileSync(join(root, 'toy/toy.toml'), 'param = 1\n')
  writeFileSync(join(root, 'pipeline.toml'), '[budget.images]\nproject = 10\nrun = 4\n')
  options.prepare?.(root)
  const toy = toyPipeline()
  const runtime = ManagedRuntime.make(options.layer ?? Layer.merge(FilesLive, ProcessRunnerLive))
  const server = createPipelinesServer({
    root,
    pipelines: [toy],
    runtime,
    env: options.env ?? {},
    ...(options.reviewTimeoutMs === undefined ? {} : { reviewTimeoutMs: options.reviewTimeoutMs }),
  })
  const client = new Client(
    { name: 'test', version: '1' },
    { capabilities: options.answer === undefined ? {} : { elicitation: {} } },
  )
  const prompts: string[] = []
  const answer = options.answer
  if (answer !== undefined)
    client.setRequestHandler(ElicitRequestSchema, async (request) => {
      prompts.push(request.params.message)
      return answer(request.params.message)
    })
  const [serverSide, clientSide] = InMemoryTransport.createLinkedPair()
  await Promise.all([server.connect(serverSide), client.connect(clientSide)])
  const auditPath = join(root, AUDIT_LOG)
  return {
    root,
    runtime,
    client,
    prompts,
    call: async (name, args = {}) => {
      const result = (await client.callTool({ name, arguments: args })) as {
        isError?: boolean
        content: { type: string; text: string }[]
      }
      const text = result.content[0]?.text ?? ''
      let data: Record<string, unknown> = {}
      try {
        data = JSON.parse(text) as Record<string, unknown>
      } catch {
        data = {}
      }
      return { error: result.isError === true, text, data }
    },
    personApproves: async (gate) =>
      (await runtime.runPromise(runPipeline(toy, { command: 'approve', target: join(root, 'toy'), gate })))
        .exit,
    auditLines: () =>
      existsSync(auditPath)
        ? readFileSync(auditPath, 'utf8')
            .trimEnd()
            .split('\n')
            .map((line) => JSON.parse(line) as AuditEntry)
        : [],
    gates: () => gateFileSchema.parse(JSON.parse(readFileSync(join(root, 'toy/gates.json'), 'utf8'))),
  }
}
