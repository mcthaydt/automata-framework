import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { Layer, ManagedRuntime } from 'effect'
import { SIGNAL_CODES } from './main.ts'
import { createPipelinesServer, interruptCalls } from './mcp-server.ts'
import { FilesLive, ProcessRunnerLive } from './node-seams.ts'
import { REGISTERED } from './registry.ts'

// The `automata-pipe-mcp` bin: the pipelines MCP server over stdio, started by the agent's client in the project root
// (it bounds the targets). stdout is the protocol; the one log line goes to stderr. A client registers it as
//   { "mcpServers": { "pipelines": { "command": "automata-pipe-mcp" } } }
// (DX.7's plugin writes that registration for a game that installs pipelines, M3-D12.) A client stops it with
// SIGTERM (or a person with Ctrl-C): the calls in flight are interrupted first, so their locks are released.

const runtime = ManagedRuntime.make(Layer.merge(FilesLive, ProcessRunnerLive))
const server = createPipelinesServer({ root: process.cwd(), pipelines: REGISTERED, runtime })
for (const [signal, code] of Object.entries(SIGNAL_CODES))
  process.once(signal, () => {
    void interruptCalls(server).finally(() => process.exit(code))
  })
await server.connect(new StdioServerTransport())
process.stderr.write('pipelines MCP server ready\n')
