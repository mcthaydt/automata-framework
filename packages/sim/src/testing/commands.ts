// The Vitest browser command that lets golden tests read golden files in a browser. It runs in
// Node, in the Vitest server; register it with `browser: { commands: goldenCommands() }`. There is deliberately
// no write command.
// Node modules load inside the command, so the ./sim entry stays importable in a browser page.
import type { BrowserCommand } from 'vitest/node'

const isMissing = (err: unknown): boolean => (err as { code?: string }).code === 'ENOENT'

/**
 * Only golden files inside the project may be read, so the command cannot serve arbitrary files. The check runs on
 * real paths, so a symlink inside the project cannot lead out of it. Null when the file does not exist.
 */
async function checkGoldenPath(root: string, path: string): Promise<string | null> {
  const { isAbsolute, relative, resolve } = await import('node:path')
  const { realpath } = await import('node:fs/promises')
  const refuse = (): never => {
    throw new Error(`readGolden: ${path} is not inside ${root}`)
  }
  const isInside = (from: string, to: string): boolean => {
    const inside = relative(from, to)
    return !inside.startsWith('..') && !isAbsolute(inside)
  }
  if (!isAbsolute(path) || !isInside(root, resolve(path))) refuse()
  if (!/\.(?:golden\.json|replay)$/.test(path)) throw new Error(`readGolden: ${path} is not a golden file`)
  let real: string
  try {
    real = await realpath(path)
  } catch (err) {
    if (isMissing(err)) return null
    throw err
  }
  if (!isInside(await realpath(root), real)) refuse()
  if (!/\.(?:golden\.json|replay)$/.test(real)) throw new Error(`readGolden: ${path} is not a golden file`)
  return real
}

const readGoldenUnder =
  (root: string | undefined): BrowserCommand<[path: string], Promise<string | null>> =>
  async (ctx, path) => {
    const file = await checkGoldenPath(root ?? ctx.project.config.root, path)
    if (file === null) return null
    const { readFile } = await import('node:fs/promises')
    try {
      return (await readFile(file)).toString('base64')
    } catch (err) {
      if (isMissing(err)) return null
      throw err
    }
  }

/** Options for {@link goldenCommands}. */
export interface GoldenCommandsOptions {
  /**
   * The folder golden files must be inside; defaults to the Vitest project's root. A package whose goldens sit
   * beside it rather than under it names an absolute folder holding both.
   */
  readonly root?: string
}

/**
 * The Vitest browser commands that let golden tests read golden files in a browser: register them with
 * `browser: { commands: goldenCommands() }`. Only `.golden.json` and `.replay` files inside the project root
 * can be read, and nothing can be written.
 */
export function goldenCommands(
  options: GoldenCommandsOptions = {},
): Record<string, BrowserCommand<[path: string], Promise<string | null>>> {
  return { readGolden: readGoldenUnder(options.root) }
}
