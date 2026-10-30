#!/usr/bin/env node
import { FilesLive, ProcessRunnerLive } from '@mcthaydt/automata-node'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { Layer, ManagedRuntime } from 'effect'
import { createPipelinesServer } from './mcp-server.ts'
import { REGISTERED } from './registry.ts'

// The `automata-pipe-mcp` bin: the pipelines MCP server over stdio, started by the agent's client in the project root
// (the folder holding pipeline.toml), which bounds the targets and holds docs/pipeline-audit.jsonl. stdout is the
// protocol; the one log line goes to stderr. A client registers it as
//   { "mcpServers": { "pipelines": { "command": "automata-pipe-mcp" } } }
// (DX.7's plugin writes that registration for a game that installs pipelines, M3-D12.)

const runtime = ManagedRuntime.make(Layer.merge(FilesLive, ProcessRunnerLive))
const server = createPipelinesServer({ root: process.cwd(), pipelines: REGISTERED, runtime })
await server.connect(new StdioServerTransport())
process.stderr.write('pipelines MCP server ready\n')
