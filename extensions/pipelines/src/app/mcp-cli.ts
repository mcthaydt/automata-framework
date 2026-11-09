#!/usr/bin/env -S node --experimental-transform-types --disable-warning=ExperimentalWarning
import { registerTsResolve } from '../shared/ts-resolve.ts'

// The `automata-pipe-mcp` bin. The hook registers before anything else loads, for the reason `cli.ts` gives.
registerTsResolve()
await import('./mcp-main.ts')
