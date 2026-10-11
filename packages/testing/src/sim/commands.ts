// The Vitest browser command that lets golden tests read golden files in a browser (M2.3 spec §3.8). It runs in
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

const readGolden: BrowserCommand<[path: string], Promise<string | null>> = async (ctx, path) => {
  const file = await checkGoldenPath(ctx.project.config.root, path)
  if (file === null) return null
  const { readFile } = await import('node:fs/promises')
  try {
    return (await readFile(file)).toString('base64')
  } catch (err) {
    if (isMissing(err)) return null
    throw err
  }
}

export function goldenCommands(): Record<string, BrowserCommand<[path: string], Promise<string | null>>> {
  return { readGolden }
}
