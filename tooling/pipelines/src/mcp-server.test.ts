import { existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { FilesLive, ProcessRunnerLive } from '@mcthaydt/automata-node'
import { Layer, TestClock, TestContext } from 'effect'
import { afterEach, describe, expect, it } from 'vitest'
import { TOOL_NAMES } from './mcp-server.ts'
import { mcpProject, TOY } from './testing/mcp-client.ts'

// The pipelines MCP server (The Last Light's tests/mcp-server.test.ts at 92e6704), through the SDK's in-memory client,
// against the toy pipeline in a temp folder: the tools and their schemas, no tool that decides, estimate tokens,
// budgets, redaction and one audit line per call.

const temps: string[] = []
afterEach(async () => {
  const { rmSync } = await import('node:fs')
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('the pipelines MCP server', () => {
  it('lists the seven platform tools with strict input schemas, and none that decides', async () => {
    const { client } = await mcpProject(temps)
    const { tools } = await client.listTools()
    const names = tools.map((tool) => tool.name)
    expect(names).toEqual([
      'pipeline_list',
      'pipeline_status',
      'pipeline_estimate',
      'pipeline_run',
      'pipeline_check',
      'pipeline_request_review',
      'pipeline_review_status',
    ])
    expect(names).toEqual([...TOOL_NAMES])
    expect(names.filter((name) => /approve|reject|decide/.test(name))).toEqual([])
    const run = tools.find((tool) => tool.name === 'pipeline_run')?.inputSchema as {
      type: string
      properties: Record<string, unknown>
      required?: string[]
      additionalProperties?: boolean
    }
    expect(run.type).toBe('object')
    expect(Object.keys(run.properties).sort()).toEqual([
      'force',
      'from',
      'only',
      'pipeline',
      'target',
      'to',
      'token',
    ])
    expect(run.required?.sort()).toEqual(['pipeline', 'target'])
    expect(run.additionalProperties).toBe(false)
    const review = tools.find((tool) => tool.name === 'pipeline_request_review')?.inputSchema as {
      required?: string[]
    }
    expect(review.required?.sort()).toEqual(['gate', 'pipeline', 'target'])
  })

  it('lists the pipelines with their stages, and the planned ones', async () => {
    const { call } = await mcpProject(temps)
    const list = await call('pipeline_list')
    expect(list.error).toBe(false)
    expect(list.data).toEqual({
      pipelines: [
        {
          name: 'toy',
          stages: [
            { id: 'one' },
            { id: 'two', gate: 'T1' },
            { id: 'three' },
            { id: 'paid', cost: { budget: 'images', units: 1 } },
          ],
        },
      ],
      planned: ['character', 'props'],
    })
  })

  it('refuses invalid input, a target outside the project and a missing one, and logs each', async () => {
    const { call, auditLines } = await mcpProject(temps)
    const unknownPipeline = await call('pipeline_status', { pipeline: 'nope', target: 'toy' })
    expect([unknownPipeline.error, unknownPipeline.data.exit]).toEqual([true, 1])
    expect(unknownPipeline.data.error).toMatch(/^invalid input: pipeline/)
    expect((await call('pipeline_status', { pipeline: 'toy' })).data.error).toMatch(/target/)
    expect((await call('pipeline_status', { ...TOY, extra: true })).data.error).toMatch(/extra/)
    const outside = await call('pipeline_status', { pipeline: 'toy', target: '../../etc' })
    expect([outside.error, outside.data.exit, outside.data.error]).toEqual([
      true,
      4,
      'refused: target ../../etc is outside the project',
    ])
    const missing = await call('pipeline_status', { pipeline: 'toy', target: 'nowhere' })
    expect([missing.error, missing.data.exit, missing.data.error]).toEqual([
      true,
      1,
      'target nowhere does not exist',
    ])
    expect(auditLines().map((line) => [line.tool, line.ok])).toEqual([
      ['pipeline_status', false],
      ['pipeline_status', false],
      ['pipeline_status', false],
      ['pipeline_status', false],
      ['pipeline_status', false],
    ])
  })

  it('a planned pipeline answers exit 2', async () => {
    const { call } = await mcpProject(temps)
    const planned = await call('pipeline_status', { pipeline: 'props', target: 'toy' })
    expect([planned.error, planned.data.exit, planned.data.error]).toEqual([
      true,
      2,
      'props: not implemented',
    ])
  })

  it('refuses a tool that would decide a gate with exit 4, and any other unknown tool, and logs both', async () => {
    const { call, auditLines } = await mcpProject(temps)
    await call('pipeline_run', TOY)
    const approve = await call('pipeline_approve', { ...TOY, gate: 'T1' })
    expect([approve.error, approve.data.exit]).toEqual([true, 4])
    expect(approve.data.error).toBe(
      'refused: no tool decides a gate; only a person does, through pipeline_request_review',
    )
    const unknown = await call('pipeline_teleport', {})
    expect([unknown.error, unknown.data.exit, unknown.data.error]).toEqual([
      true,
      1,
      'unknown tool pipeline_teleport',
    ])
    expect(auditLines().map((line) => [line.tool, line.ok, line.args])).toEqual([
      ['pipeline_run', true, TOY],
      ['pipeline_approve', false, { ...TOY, gate: 'T1' }],
      ['pipeline_teleport', false, {}],
    ])
  })

  it('runs free stages to a gate, and refuses an unestimated or forged paid run', async () => {
    const { call, personApproves, root } = await mcpProject(temps)
    const first = await call('pipeline_run', TOY)
    expect([first.error, first.data.exit]).toEqual([false, 3])
    expect(first.data.gates).toEqual([expect.objectContaining({ id: 'T1', decision: 'pending' })])
    expect(await personApproves('T1')).toBe(0)
    const unestimated = await call('pipeline_run', TOY)
    expect([unestimated.error, unestimated.data.exit, unestimated.data.error]).toEqual([
      true,
      4,
      'refused: paid is paid; call pipeline_estimate first and pass its token',
    ])
    const forged = await call('pipeline_run', { ...TOY, token: 'not-a-token' })
    expect([forged.error, forged.data.exit, forged.data.error]).toEqual([
      true,
      4,
      'refused: the estimate token is not one this server issued; call pipeline_estimate',
    ])
    expect(existsSync(join(root, 'toy/paid.txt'))).toBe(false)
  })

  it('runs a paid stage with a matching token and logs what the ledger was charged', async () => {
    const { call, personApproves, auditLines } = await mcpProject(temps)
    await call('pipeline_run', TOY)
    await personApproves('T1')
    const estimate = await call('pipeline_estimate', TOY)
    expect(estimate.data).toMatchObject({ exit: 0, estimate: { images: 1 }, expiresInMinutes: 30 })
    expect((estimate.data.data as { plan: { id: string }[] }).plan.map((row) => row.id)).toEqual([
      'three',
      'paid',
    ])
    const token = estimate.data.token as string
    const run = await call('pipeline_run', { ...TOY, token })
    expect([run.error, run.data.exit, run.data.spent]).toEqual([false, 0, { images: 1 }])
    const lines = auditLines()
    expect(lines.at(-1)).toMatchObject({ tool: 'pipeline_run', ok: true, cost: { images: 1 } })
    expect(lines.filter((line) => line.cost !== undefined)).toHaveLength(1)
  })

  it('refuses a token older than 30 minutes, and one whose inputs changed', async () => {
    const { call, personApproves, runtime, root } = await mcpProject(temps, {
      layer: Layer.mergeAll(FilesLive, ProcessRunnerLive, TestContext.TestContext),
    })
    await call('pipeline_run', TOY)
    await personApproves('T1')
    const old = (await call('pipeline_estimate', TOY)).data.token as string
    await runtime.runPromise(TestClock.adjust('31 minutes'))
    expect((await call('pipeline_run', { ...TOY, token: old })).data.error).toBe(
      'refused: the estimate token is older than 30 minutes; estimate again',
    )
    const fresh = (await call('pipeline_estimate', TOY)).data.token as string
    writeFileSync(join(root, 'toy/two.txt'), 'edited upstream\n')
    const changed = await call('pipeline_run', { ...TOY, token: fresh })
    expect([changed.data.exit, changed.data.error]).toEqual([
      4,
      'refused: the estimate token does not match these stages or their inputs any more; estimate again',
    ])
    expect(existsSync(join(root, 'toy/paid.txt'))).toBe(false)
  })

  it("answers a stage failure as a tool error with the runner's result", async () => {
    const { call, root } = await mcpProject(temps)
    writeFileSync(join(root, 'toy/toy.toml'), 'param = 1\nfail = "one"\n')
    const failed = await call('pipeline_run', TOY)
    expect([failed.error, failed.data.exit, failed.data.error]).toEqual([
      true,
      1,
      'one: one was told to fail',
    ])
  })

  it('runs the checks and the status', async () => {
    const { call } = await mcpProject(temps)
    await call('pipeline_run', TOY)
    const status = await call('pipeline_status', TOY)
    expect([status.error, status.data.exit]).toEqual([false, 0])
    const check = await call('pipeline_check', TOY)
    expect([check.error, check.data.exit]).toEqual([false, 0])
  })

  it('writes one audit line per call with its time, duration and head, and redacts keys', async () => {
    const secret = 'openai-secret-value'
    const { call, auditLines } = await mcpProject(temps, { env: { OPENAI_API_KEY: secret } })
    await call('pipeline_list')
    await call('pipeline_status', TOY)
    const leaked = await call('pipeline_status', { pipeline: 'toy', target: `toy-${secret}` })
    expect(leaked.text).not.toContain(secret)
    expect(leaked.text).toContain('[redacted]')
    const lines = auditLines()
    expect(lines.map((line) => [line.tool, line.ok])).toEqual([
      ['pipeline_list', true],
      ['pipeline_status', true],
      ['pipeline_status', false],
    ])
    for (const line of lines)
      expect(line).toMatchObject({
        at: expect.stringMatching(/^\d{4}-\d\d-\d\dT/),
        ms: expect.any(Number),
        head: 'unknown',
        summary: expect.any(String),
      })
    expect(JSON.stringify(lines)).not.toContain(secret)
  })

  it('redacts a key before cutting a long summary, so no part of it reaches the log', async () => {
    const secret = 'openai-secret-value'
    const { call, auditLines } = await mcpProject(temps, { env: { OPENAI_API_KEY: secret } })
    // "target " is 7 characters: the key starts at 487 and the 500-character cut would fall inside it.
    await call('pipeline_status', { pipeline: 'toy', target: `${'x'.repeat(480)}${secret}` })
    const summary = auditLines()[0]?.summary ?? ''
    expect(summary).not.toContain('openai-se')
    expect(summary).toContain('[redacted]')
  })

  it('takes a folder whose name starts with two dots as inside the project', async () => {
    const { call, root } = await mcpProject(temps)
    const { mkdirSync, writeFileSync: write } = await import('node:fs')
    mkdirSync(join(root, '..toy'))
    write(join(root, '..toy/toy.toml'), 'param = 1\n')
    write(join(root, '..toy/src.txt'), 'source\n')
    const status = await call('pipeline_status', { pipeline: 'toy', target: '..toy' })
    expect([status.error, status.data.exit]).toEqual([false, 0])
  })

  it('takes an estimate token once', async () => {
    const { call, personApproves } = await mcpProject(temps)
    await call('pipeline_run', TOY)
    await personApproves('T1')
    await call('pipeline_run', { ...TOY, to: 'three' })
    const token = (await call('pipeline_estimate', TOY)).data.token as string
    expect((await call('pipeline_run', { ...TOY, token })).data.exit).toBe(0)
    const again = await call('pipeline_run', { ...TOY, token, only: ['paid'], force: true })
    expect([again.data.exit, again.data.error]).toEqual([
      4,
      'refused: the estimate token is not one this server issued; call pipeline_estimate',
    ])
  })

  it('refuses a target that a symbolic link takes outside the project', async () => {
    const { call, root } = await mcpProject(temps)
    const { cpSync, mkdtempSync, symlinkSync } = await import('node:fs')
    const { tmpdir } = await import('node:os')
    const outside = mkdtempSync(join(tmpdir(), 'pipe-outside-'))
    temps.push(outside)
    cpSync(join(root, 'toy'), join(outside, 'toy'), { recursive: true })
    symlinkSync(join(outside, 'toy'), join(root, 'link'))
    const linked = await call('pipeline_status', { pipeline: 'toy', target: 'link' })
    expect([linked.error, linked.data.exit, linked.data.error]).toEqual([
      true,
      4,
      'refused: target link is outside the project',
    ])
  })

  it('logs a malformed call (arguments not an object, a name not a string) and answers it as invalid', async () => {
    const { client, auditLines } = await mcpProject(temps)
    const { CallToolResultSchema } = await import('@modelcontextprotocol/sdk/types.js')
    const send = (params: Record<string, unknown>) =>
      client.request({ method: 'tools/call', params } as never, CallToolResultSchema)
    const notObject = await send({ name: 'pipeline_status', arguments: 'toy' })
    expect(notObject.isError).toBe(true)
    expect(JSON.parse((notObject.content[0] as { text: string }).text)).toMatchObject({ exit: 1 })
    const notString = await send({ name: 42, arguments: {} })
    expect(notString.isError).toBe(true)
    expect(auditLines().map((line) => [line.tool, line.ok, line.args])).toEqual([
      ['pipeline_status', false, 'toy'],
      ['42', false, {}],
    ])
  })

  it('answers with the result beside the error when the audit line cannot be written', async () => {
    const { client, root } = await mcpProject(temps)
    writeFileSync(join(root, 'docs'), 'a file where the log folder should be\n')
    const result = (await client.callTool({ name: 'pipeline_list', arguments: {} })) as {
      isError?: boolean
      content: { text: string }[]
    }
    expect(result.isError).toBe(true)
    expect(result.content[0]?.text).toMatch(/^audit log: /)
    expect(JSON.parse(result.content[1]?.text ?? '')).toMatchObject({ planned: ['character', 'props'] })
  })
})
