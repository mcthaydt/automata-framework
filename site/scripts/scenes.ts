import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import type { SceneExample } from '../src/shared/framework/examples.ts'

// What the site keeps of the runner's build of the 3D examples folder (`buildScenes` in build-demos.ts). The runner
// builds every example of the folder in one go, so the output also holds the examples the site does not show, which
// import packages a stranger could not install. Their pages and the code only they load are taken out before the
// folder is served, so what is public is what the reader chose (`sceneExamples`).

/** The part of a scene example this step needs. */
export type KeptScene = Pick<SceneExample, 'id' | 'module' | 'name' | 'still'>

/** Every file under `dir`, as paths from `dir`. */
const filesUnder = (dir: string): string[] =>
  readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name).slice(dir.length + 1))

/**
 * The files of `assets/` a page needs: those its page names, and those any of those names, and so on. A file is named
 * where its own file name appears, which is how a chunk imports another (`./shared-x.js`) and how code asks for a
 * texture (`new URL('tex-x.png', import.meta.url)`); a name found by chance keeps a file that was not needed, never
 * drops one that was.
 */
function neededAssets(out: string, pages: readonly string[]): Set<string> {
  const assets = filesUnder(join(out, 'assets')).map((path) => path.replaceAll('\\', '/'))
  const needed = new Set<string>()
  const queue = pages.map((page) => readFileSync(join(out, page), 'utf8'))
  for (let text = queue.pop(); text !== undefined; text = queue.pop()) {
    for (const asset of assets) {
      const name = asset.split('/').pop() as string
      if (needed.has(asset) || !text.includes(name)) continue
      needed.add(asset)
      if (/\.(js|css)$/.test(asset)) queue.push(readFileSync(join(out, 'assets', asset), 'utf8'))
    }
  }
  return needed
}

/**
 * Leaves `out` (the runner's build) holding only the pages of `scenes`, each at `<module>/<name>/` with its source page,
 * the files of `assets/` they load, and `stills/<id>.png` for each approved still, copied from `examples` (the folder
 * that was built). The pages name their files relative to themselves, so none moves.
 */
export function arrangeScenes(out: string, examples: string, scenes: readonly KeptScene[]): void {
  const pages = scenes.flatMap((scene) => [
    `${scene.module}/${scene.name}/index.html`,
    `${scene.module}/${scene.name}/source/index.html`,
  ])
  const needed = neededAssets(out, pages)
  const kept = new Set([...pages, ...[...needed].map((asset) => `assets/${asset}`)])
  for (const file of filesUnder(out).map((path) => path.replaceAll('\\', '/')))
    if (!kept.has(file)) rmSync(join(out, file))
  // The folders the removals emptied.
  for (const dir of readdirSync(out, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(entry.parentPath, entry.name))
    .sort((a, b) => b.length - a.length))
    if (existsSync(dir) && readdirSync(dir).length === 0) rmSync(dir, { recursive: true })
  for (const scene of scenes) {
    if (scene.still === undefined) continue
    mkdirSync(join(out, 'stills'), { recursive: true })
    cpSync(join(examples, scene.module, `${scene.id}.png`), join(out, 'stills', `${scene.id}.png`))
  }
}
