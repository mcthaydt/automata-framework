import { dirname, join } from 'node:path'
import { Effect } from 'effect'
import { Files } from '../node/files.ts'
import type { Catalog } from './catalog.ts'

// The words of the framework packages a game uses, found the way the font build finds them (`gameWords` in
// `@automataframework/content`, which tools never imports at run time, so this is its own small copy and a test keeps the two
// equal): `<package>/words/<lang>.json` through the package's `exports`, looked for from the game's folder up through the
// `node_modules` folders on the way and nowhere else.

/** The packages whose screens carry words. */
const WORD_PACKAGES = [
  '@automataframework/framework',
  '@automataframework/ui-screens',
  '@automataframework/net-ui',
] as const

const textOnly = (value: unknown): Catalog | undefined => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined
  const out: Record<string, string> = {}
  for (const [key, text] of Object.entries(value))
    if (key !== '$schema' && typeof text === 'string') out[key] = text
  return out
}

/** Each of the packages the game has that carries words in `lang`, by package name. */
export function packageCatalogs(
  gameDir: string,
  lang: string,
): Effect.Effect<ReadonlyMap<string, Catalog>, never, Files> {
  return Effect.gen(function* () {
    const files = yield* Files
    const found = new Map<string, Catalog>()
    for (const name of WORD_PACKAGES) {
      let root: string | undefined
      for (let dir = gameDir; root === undefined; dir = dirname(dir)) {
        const candidate = join(dir, 'node_modules', name)
        if (yield* files.exists(join(candidate, 'package.json'))) root = candidate
        else if (dirname(dir) === dir) break
      }
      if (root === undefined) continue
      const manifest = yield* files.readText(join(root, 'package.json')).pipe(Effect.option)
      if (manifest._tag === 'None') continue
      let target: unknown
      try {
        const exported = (JSON.parse(manifest.value) as { exports?: Record<string, unknown> }).exports?.[
          './words/*.json'
        ]
        target =
          typeof exported === 'string' ? exported : (exported as { default?: unknown } | undefined)?.default
      } catch {
        continue
      }
      if (typeof target !== 'string') continue
      const text = yield* files.readText(join(root, target.replace('*', lang))).pipe(Effect.option)
      if (text._tag === 'None') continue
      try {
        const catalog = textOnly(JSON.parse(text.value))
        if (catalog !== undefined) found.set(name, catalog)
      } catch {}
    }
    return found
  })
}
