import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
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

  it("is the game's, beside games/base-3d/pipeline.toml, when the server starts at the repository root", async () => {
    const repo = temp()
    const game = join(repo, 'games/base-3d')
    mkdirSync(join(game, 'toy'), { recursive: true })
    writeFileSync(join(game, 'pipeline.toml'), '')
    writeFileSync(join(game, 'toy/toy.toml'), 'param = 1\n')
    writeFileSync(join(game, 'toy/src.txt'), 'source\n')
    const server = createPipelinesServer({
      root: repo,
      pipelines: [toyPipeline()],
      runtime: ManagedRuntime.make(live),
      env: {},
    })
    const client = new Client({ name: 'test', version: '1' })
    const [a, b] = InMemoryTransport.createLinkedPair()
    await Promise.all([server.connect(a), client.connect(b)])
    await client.callTool({
      name: 'pipeline_status',
      arguments: { pipeline: 'toy', target: 'games/base-3d/toy' },
    })
    const refused = await Effect.runPromise(
      route(['toy', 'approve', join(game, 'toy'), 'T1'], [toyPipeline()], undefined, {
        agent: true,
        env: {},
      }).pipe(Effect.provide(live)),
    )
    expect(refused.exit).toBe(4)
    const { readFileSync } = await import('node:fs')
    const lines = readFileSync(join(game, 'docs/pipeline-audit.jsonl'), 'utf8').trimEnd().split('\n')
    expect(lines.map((line) => JSON.parse(line).tool)).toEqual(['pipeline_status', 'automata-pipe approve'])
    expect(existsSync(join(repo, 'docs'))).toBe(false)
  })

  it("follows a symbolic link to the game: the refusal is in the game's log, not the link's folder's", async () => {
    const game = temp()
    writeFileSync(join(game, 'pipeline.toml'), '')
    mkdirSync(join(game, 'art/wren'), { recursive: true })
    const decoy = temp()
    writeFileSync(join(decoy, 'pipeline.toml'), '')
    symlinkSync(join(game, 'art/wren'), join(decoy, 'link'))
    const out = await Effect.runPromise(
      route(['toy', 'approve', join(decoy, 'link'), 'G6'], [toyPipeline()], undefined, {
        agent: true,
        env: {},
      }).pipe(Effect.provide(live)),
    )
    expect(out.exit).toBe(4)
    expect(existsSync(join(game, 'docs/pipeline-audit.jsonl'))).toBe(true)
    expect(existsSync(join(decoy, 'docs'))).toBe(false)
  })
})
