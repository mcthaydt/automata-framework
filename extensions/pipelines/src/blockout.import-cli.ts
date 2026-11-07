// The `import` command's file work (BP-D3): reads a folder's `blockout.pipe.toml`, its map and graph, and writes the spec file it names.
// It is not a pipeline stage (the platform has no one-off commands), so it has its own entry: `automata-blockout-import <folder> [--force]`.
// It refuses to overwrite the spec without `--force` (exit 4) and says which file it could not load (exit 1).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { parse } from 'smol-toml'
import { z } from 'zod'
import { EXIT, type PipelineExit } from './exit.ts'

export interface ImportOutcome {
  readonly exit: PipelineExit
  readonly message: string
  readonly todo?: readonly string[]
}

const files = z.object({ blockout: z.string().min(1), map: z.string().min(1), nav: z.string().min(1) })

export async function importFolder(dir: string, options: { force: boolean }): Promise<ImportOutcome> {
  const root = resolve(dir)
  const read = (path: string): unknown => {
    try {
      return parse(readFileSync(join(root, path), 'utf8'))
    } catch (cause) {
      throw new Error(`${path}: ${cause instanceof Error ? cause.message : String(cause)}`)
    }
  }
  try {
    const spec = files.safeParse(read('blockout.pipe.toml'))
    if (!spec.success)
      return {
        exit: EXIT.failed,
        message: `blockout.pipe.toml: ${spec.error.issues.map((i) => i.message).join('; ')}`,
      }
    const out = join(root, spec.data.blockout)
    if (existsSync(out) && !options.force)
      return { exit: EXIT.refused, message: `${spec.data.blockout} exists; pass --force to overwrite it` }
    const { sectorMapSchema } = await import('@mcthaydt/automata-sectors/sim')
    const { navGraphSchema } = await import('@mcthaydt/automata-nav/sim')
    const { importBlockout } = await import('./blockout.import.ts')
    const map = sectorMapSchema.safeParse(read(spec.data.map))
    if (!map.success)
      return {
        exit: EXIT.failed,
        message: `${spec.data.map}: ${map.error.issues.map((i) => i.message).join('; ')}`,
      }
    const nav = navGraphSchema.safeParse(read(spec.data.nav))
    if (!nav.success)
      return {
        exit: EXIT.failed,
        message: `${spec.data.nav}: ${nav.error.issues.map((i) => i.message).join('; ')}`,
      }
    const scene = (spec.data.map.split('/').pop() ?? 'scene').replace(/\.toml$/, '')
    const { blockout, todo } = importBlockout(scene, map.data as never, nav.data as never)
    mkdirSync(dirname(out), { recursive: true })
    writeFileSync(out, `${JSON.stringify(blockout, null, 2)}\n`)
    return { exit: EXIT.done, message: `wrote ${spec.data.blockout}`, todo }
  } catch (error) {
    return { exit: EXIT.failed, message: error instanceof Error ? error.message : String(error) }
  }
}

if (import.meta.main) {
  const argv = process.argv.slice(2)
  const target = argv.find((arg) => !arg.startsWith('--'))
  if (target === undefined) {
    process.stderr.write('usage: automata-blockout-import <folder> [--force]\n')
    process.exit(EXIT.failed)
  }
  const { registerTsResolve } = await import('./ts-resolve.ts')
  registerTsResolve()
  const outcome = await importFolder(target, { force: argv.includes('--force') })
  process.stderr.write(`${outcome.message}\n`)
  for (const line of outcome.todo ?? []) process.stderr.write(`todo: ${line}\n`)
  process.exitCode = outcome.exit
}
