// The Vitest browser command that lets golden tests read golden files in a browser (M2.3 spec §3.8). It runs in
// Node, in the Vitest server; register it with `browser: { commands: goldenCommands() }`. There is deliberately
// no write command.
// Node modules load inside the command, so the ./sim entry stays importable in a browser page.
import type { BrowserCommand } from 'vitest/node'

/** Only golden files inside the project may be read, so the command cannot serve arbitrary files. */
async function checkGoldenPath(root: string, path: string): Promise<string> {
  const { isAbsolute, relative, resolve } = await import('node:path')
  const absolute = resolve(path)
  const inside = relative(root, absolute)
  if (!isAbsolute(path) || inside.startsWith('..') || isAbsolute(inside))
    throw new Error(`readGolden: ${path} is not inside ${root}`)
  if (!/\.(?:golden\.json|replay)$/.test(absolute))
    throw new Error(`readGolden: ${path} is not a golden file`)
  return absolute
}

const readGolden: BrowserCommand<[path: string], Promise<string | null>> = async (ctx, path) => {
  const file = await checkGoldenPath(ctx.project.config.root, path)
  const { readFile } = await import('node:fs/promises')
  try {
    return (await readFile(file)).toString('base64')
  } catch (err) {
    if ((err as { code?: string }).code === 'ENOENT') return null
    throw err
  }
}

export function goldenCommands(): Record<string, BrowserCommand<[path: string], Promise<string | null>>> {
  return { readGolden }
}
