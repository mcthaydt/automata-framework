#!/usr/bin/env node
// Usage: node tooling/core-packs/src/cli.ts --out <dir> [--extra <package name>]... [--source-commit <sha>] [--allow-dirty] [--unpack]
// Packs every published workspace package, plus the named private extras, into <dir> and writes <dir>/packs.json
// (run `pnpm build` first). See pack.ts.
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { parseArgs, resolveSourceCommit } from './args.ts'
import { packWorkspace } from './pack.ts'

const root = fileURLToPath(new URL('../../..', import.meta.url))

try {
  const args = parseArgs(process.argv.slice(2))
  const git = (gitArgs: readonly string[]) =>
    execFileSync('git', [...gitArgs], { cwd: root, encoding: 'utf8' })
  const manifest = packWorkspace({
    root,
    out: args.out,
    extras: args.extras,
    unpack: args.unpack,
    sourceCommit: resolveSourceCommit(args, git),
  })
  console.log(`core-packs: ${manifest.packs.length} packs from ${manifest.sourceCommit} in ${args.out}`)
} catch (error) {
  console.error(`core-packs: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(2)
}
