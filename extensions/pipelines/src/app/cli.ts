#!/usr/bin/env -S node --experimental-transform-types --disable-warning=ExperimentalWarning
import { registerTsResolve } from '../shared/ts-resolve.ts'

// The `automata-pipe` bin. The hook registers before anything else loads: the extensions a stage drives, and the
// core packages under them, are TypeScript sources with extensionless imports, and ES module imports are all
// resolved before the first line of the module that holds them runs.
registerTsResolve()
await import('./pipe-main.ts')
