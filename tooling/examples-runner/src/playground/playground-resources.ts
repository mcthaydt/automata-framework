import { type CatalogEntry, isUnpublishedExtension } from '../catalog.ts'

const RESOURCE_REFERENCE = /['"`]\.\.\/resources\/([^'"`]+)['"`]/g

/** Every `../resources/<path>` an example's source names. */
function resourcesNamed(source: string): string[] {
  return [...source.matchAll(RESOURCE_REFERENCE)].map((match) => match[1] as string)
}

/**
 * Which of `examples/resources/` the public website may carry. A
 * file is left out when only examples of an unpublished extension (render-pixi3d, on the closed `@pixi/3d` beta)
 * name it, and a folder is left out with everything in it when every file it holds besides its notes (`.md`) is
 * left out, as `models/` is. Returns a filter over paths relative to the resources folder, files and folders alike.
 */
export function publicResource(
  entries: readonly CatalogEntry[],
  readSource: (entry: CatalogEntry) => string,
  files: readonly string[],
): (path: string) => boolean {
  const publicNames = new Set<string>()
  const privateNames = new Set<string>()
  for (const entry of entries) {
    const into = entry.imports.some(isUnpublishedExtension) ? privateNames : publicNames
    for (const name of resourcesNamed(readSource(entry))) into.add(name)
  }
  const isPrivateFile = (file: string): boolean => privateNames.has(file) && !publicNames.has(file)
  const folderOf = (path: string): string => path.slice(0, Math.max(0, path.lastIndexOf('/')))
  const privateFolders = new Set<string>()
  for (const folder of new Set(files.map(folderOf).filter((folder) => folder !== ''))) {
    const assets = files.filter((file) => folderOf(file) === folder && !file.endsWith('.md'))
    if (assets.length > 0 && assets.every(isPrivateFile)) privateFolders.add(folder)
  }
  const inPrivateFolder = (path: string): boolean =>
    [...privateFolders].some((folder) => path === folder || path.startsWith(`${folder}/`))
  return (path) => !isPrivateFile(path) && !inPrivateFolder(path)
}
