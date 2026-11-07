import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Effect } from 'effect'
import { afterEach, describe, expect, it } from 'vitest'
import { holdLedger, holdTarget, SPEND_LOCK, TARGET_LOCK } from './project.ts'

// M3.8b review round 3: a lock left by a process that is gone (Ctrl-C, a client killing the server) is taken over,
// and the bins interrupt their work on SIGINT and SIGTERM so the locks are released in the first place.

const temps: string[] = []
afterEach(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true })
})
const temp = () => {
  const dir = mkdtempSync(join(tmpdir(), 'pipe-locks-'))
  temps.push(dir)
  return dir
}
/** The pid of a process that has already exited. */
const deadPid = (): number => {
  const gone = spawnSync(process.execPath, ['-e', ''])
  return gone.pid as number
}
const take = (hold: Effect.Effect<void, string, import('effect').Scope.Scope>) =>
  Effect.runPromise(Effect.either(Effect.scoped(hold)))

describe('a lock left by a process that is gone', () => {
  it.each([
    ['the target lock', TARGET_LOCK, (dir: string) => holdTarget(dir)],
    [
      'the spend ledger lock',
      SPEND_LOCK,
      (dir: string) =>
        holdLedger({ path: join(dir, 'pipeline.toml'), toml: { budget: {}, generated: [], locked: {} } }),
    ],
  ])('%s is taken over when its pid is dead, and refused when it is alive', async (_, name, hold) => {
    const dir = temp()
    writeFileSync(join(dir, name), `${deadPid()}\n`)
    expect((await take(hold(dir)))._tag).toBe('Right')
    expect(existsSync(join(dir, name))).toBe(false)

    writeFileSync(join(dir, name), `${process.pid}\n`)
    const refused = await take(hold(dir))
    expect(refused._tag).toBe('Left')
    expect(readFileSync(join(dir, name), 'utf8')).toBe(`${process.pid}\n`)
  })
})

describe('the bins on a signal', () => {
  const holder = fileURLToPath(new URL('./testing/hold-target.ts', import.meta.url))

  it.each([
    ['SIGINT', 130],
    ['SIGTERM', 143],
  ] as const)('release the target lock on %s and exit %i', async (signal, code) => {
    const dir = temp()
    const child = spawn(process.execPath, [holder, dir], { stdio: ['ignore', 'pipe', 'pipe'] })
    // The signal too (issue #14): a status of null with the signal set means no handler was listening.
    const exited = new Promise<{ status: number | null; signal: NodeJS.Signals | null }>((done) =>
      child.on('exit', (status, signal) => done({ status, signal })),
    )
    for (let tries = 0; !existsSync(join(dir, 'held')) && tries < 600; tries++)
      await new Promise((done) => setTimeout(done, 50))
    expect(existsSync(join(dir, TARGET_LOCK))).toBe(true)
    child.kill(signal)
    expect(await exited).toEqual({ status: code, signal: null })
    expect(existsSync(join(dir, TARGET_LOCK))).toBe(false)
  })
})

describe('the MCP server on a signal', () => {
  it('interrupts its calls in flight, so their locks are released', async () => {
    const { Deferred, Layer, ManagedRuntime } = await import('effect')
    const { FilesLive, ProcessRunnerLive } = await import('@mcthaydt/automata-node')
    const { Client } = await import('@modelcontextprotocol/sdk/client/index.js')
    const { InMemoryTransport } = await import('@modelcontextprotocol/sdk/inMemory.js')
    const { z } = await import('zod')
    const { definePipeline } = await import('./pipeline.ts')
    const { createPipelinesServer, interruptCalls } = await import('./mcp-server.ts')
    const root = temp()
    const { mkdirSync } = await import('node:fs')
    mkdirSync(join(root, 'slow'))
    writeFileSync(join(root, 'slow/slow.toml'), '')
    const started = Effect.runSync(Deferred.make<void>())
    const slow = definePipeline({
      name: 'slow',
      spec: z.object({}),
      stages: [
        { id: 'wait', run: () => Effect.zipRight(Deferred.succeed(started, undefined), Effect.never) },
      ],
    })
    const server = createPipelinesServer({
      root,
      pipelines: [slow],
      runtime: ManagedRuntime.make(Layer.merge(FilesLive, ProcessRunnerLive)),
      env: {},
    })
    const client = new Client({ name: 'test', version: '1' })
    const [a, b] = InMemoryTransport.createLinkedPair()
    await Promise.all([server.connect(a), client.connect(b)])
    const pending = client.callTool({ name: 'pipeline_run', arguments: { pipeline: 'slow', target: 'slow' } })
    pending.catch(() => undefined)
    await Effect.runPromise(Deferred.await(started))
    expect(existsSync(join(root, 'slow', TARGET_LOCK))).toBe(true)
    await interruptCalls(server)
    expect(existsSync(join(root, 'slow', TARGET_LOCK))).toBe(false)
  })
})
