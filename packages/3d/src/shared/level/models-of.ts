import type { AfSector2 } from './af-sector-2.schema.ts'

/**
 * The model files a level's props name, each once, in order of name: what a game lists for the renderer to load before
 * the first frame (`createPixi3dRenderer`'s `models`). A file that is not loaded then fails boot with its name.
 */
export function modelsOf(level: AfSector2): string[] {
  const files = new Set<string>()
  for (const prop of level.props ?? []) if (prop.model !== undefined) files.add(prop.model)
  return [...files].sort()
}
