import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { Layer, ManagedRuntime } from 'effect'
import { createPipelinesServer, interruptCalls } from '../features/mcp/mcp-server.ts'
import { FilesLive } from '../shared/node/files.ts'
import { ProcessRunnerLive } from '../shared/node/process.ts'
import { SIGNAL_CODES } from './main.ts'
import { REGISTERED } from './registry.ts'

// The `automata-pipe-mcp` bin: the pipelines MCP server over stdio, started by the agent's client in the project root
// (it bounds the targets). stdout is the protocol; the one log line goes to stderr. A client registers it as
//   { "mcpServers": { "pipelines": { "command": "automata-pipe-mcp" } } }
// A client stops it with
// SIGTERM (or a person with Ctrl-C): the calls in flight are interrupted first, so their locks are released.

const runtime = ManagedRuntime.make(Layer.merge(FilesLive, ProcessRunnerLive))
const server = createPipelinesServer({ root: process.cwd(), pipelines: REGISTERED, runtime })
for (const [signal, code] of Object.entries(SIGNAL_CODES))
  process.once(signal, () => {
    void interruptCalls(server).finally(() => process.exit(code))
  })
await server.connect(new StdioServerTransport())
process.stderr.write('pipelines MCP server ready\n')
