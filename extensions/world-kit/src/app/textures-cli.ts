#!/usr/bin/env node
// The `automata-world-textures` command line: see features/textures/textures-command.ts.
import { runTextures } from '../features/textures/textures-command.ts'

const result = runTextures(process.argv.slice(2))
process.stdout.write(result.stdout)
process.stderr.write(result.stderr)
process.exit(result.code)
