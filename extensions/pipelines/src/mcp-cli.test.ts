import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { afterEach, describe, expect, it } from 'vitest'

// The `automata-pipe-mcp` bin as a client starts it (The Last Light's .mcp.json at 92e6704 starts its server the same
// way): Node runs src/mcp-cli.ts from source in the project root, and the protocol runs over stdio.

const bin = fileURLToPath(new URL('./mcp-cli.ts', import.meta.url))
const temps: string[] = []
afterEach(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('the automata-pipe-mcp bin', () => {
  it('serves the seven tools over stdio and logs each call in the working folder', async () => {
    const cwd = realpathSync(mkdtempSync(join(tmpdir(), 'pipe-mcp-bin-')))
    temps.push(cwd)
    const env = Object.fromEntries(
      Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
    )
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [bin],
      cwd,
      env,
      stderr: 'pipe',
    })
    const client = new Client({ name: 'test', version: '1' })
    await client.connect(transport)
    try {
      const { tools } = await client.listTools()
      expect(tools).toHaveLength(7)
      const list = (await client.callTool({ name: 'pipeline_list', arguments: {} })) as {
        content: { text: string }[]
      }
      expect(JSON.parse(list.content[0]?.text ?? '')).toEqual({
        // `puzzle` (M6.6b), `systems` (M6.7b), `narrative` (M6.8b), `audio` (M6.10b) and `blockout` (M6.11) are registered; character and props are still planned.
        pipelines: [
          { name: 'puzzle', stages: [{ id: 'analyse' }, { id: 'doc' }, { id: 'audit' }] },
          { name: 'systems', stages: [{ id: 'scenarios' }, { id: 'playtest' }, { id: 'sweep' }] },
          {
            name: 'narrative',
            stages: [
              { id: 'lint' },
              { id: 'coverage' },
              { id: 'screenplay' },
              { id: 'help' },
              { id: 'audit' },
            ],
          },
          { name: 'audio', stages: [{ id: 'render' }] },
          { name: 'blockout', stages: [{ id: 'validate' }, { id: 'generate' }, { id: 'shots' }] },
        ],
        planned: ['character', 'props'],
      })
    } finally {
      await client.close()
    }
    const lines = readFileSync(join(cwd, 'docs/pipeline-audit.jsonl'), 'utf8').trimEnd().split('\n')
    expect(lines.map((line) => JSON.parse(line))).toEqual([
      expect.objectContaining({ tool: 'pipeline_list', ok: true, head: 'unknown' }),
    ])
  })
})
