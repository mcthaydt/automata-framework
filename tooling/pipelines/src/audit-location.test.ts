import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { FilesLive, ProcessRunnerLive } from '@mcthaydt/automata-node'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { Effect, Layer, ManagedRuntime } from 'effect'
import { afterEach, describe, expect, it } from 'vitest'
import { createPipelinesServer } from './mcp-server.ts'
import { route } from './router.ts'
import { toyPipeline } from './testing/toy.ts'

// M3.8b review: the log is in one place for both bins (the folder of the nearest pipeline.toml), and an agent cannot
// move it: the router's refusal ignores --config, and the server has no option for it.

const temps: string[] = []
afterEach(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true })
})
const temp = () => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'pipe-where-')))
  temps.push(dir)
  return dir
}
const live = Layer.merge(FilesLive, ProcessRunnerLive)

describe('where the audit log is', () => {
  it("is beside the nearest pipeline.toml for the router's refusal, whatever --config says", async () => {
    const project = temp()
    writeFileSync(join(project, 'pipeline.toml'), '')
    mkdirSync(join(project, 'art/wren'), { recursive: true })
    const elsewhere = temp()
    writeFileSync(join(elsewhere, 'pipeline.toml'), '')
    const argv = [
      'toy',
      'approve',
      join(project, 'art/wren'),
      'G6',
      '--config',
      join(elsewhere, 'pipeline.toml'),
    ]
    const out = await Effect.runPromise(
      route(argv, [toyPipeline()], undefined, { agent: true, env: {} }).pipe(Effect.provide(live)),
    )
    expect(out.exit).toBe(4)
    expect(existsSync(join(project, 'docs/pipeline-audit.jsonl'))).toBe(true)
    expect(existsSync(join(elsewhere, 'docs'))).toBe(false)
  })

  it('is beside the nearest pipeline.toml for the server too, when it starts in a folder below it', async () => {
    const project = temp()
    writeFileSync(join(project, 'pipeline.toml'), '')
    mkdirSync(join(project, 'art'))
    const server = createPipelinesServer({
      root: join(project, 'art'),
      pipelines: [toyPipeline()],
      runtime: ManagedRuntime.make(live),
      env: {},
    })
    const client = new Client({ name: 'test', version: '1' })
    const [a, b] = InMemoryTransport.createLinkedPair()
    await Promise.all([server.connect(a), client.connect(b)])
    await client.callTool({ name: 'pipeline_list', arguments: {} })
    expect(existsSync(join(project, 'docs/pipeline-audit.jsonl'))).toBe(true)
    expect(existsSync(join(project, 'art/docs'))).toBe(false)
  })
})
