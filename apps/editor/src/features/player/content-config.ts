import type { CompileOptions } from '@mcthaydt/automata-content/compile'
import { transform } from 'sucrase'

// A game's `content.config.ts` is a plain file the app reads on a phone, where there is no Node and no Vite: it is
// stripped of types, turned into CommonJS and run against the browser-safe content entries the app carries. A file
// that imports anything else fails and says which import. The app's own compile worker runs it; a played game never does.

/** The content entries a config may import; the app passes the ones it carries. */
export type ConfigModules = Readonly<Record<string, unknown>>

/** The content package's browser entries as a config can import them. */
export async function defaultConfigModules(): Promise<ConfigModules> {
  return {
    '@mcthaydt/automata-content/compile': await import('@mcthaydt/automata-content/compile'),
    '@mcthaydt/automata-content/level-2d': await import('@mcthaydt/automata-content/level-2d'),
    '@mcthaydt/automata-content/palette': await import('@mcthaydt/automata-content/palette'),
    '@mcthaydt/automata-content/schema': await import('@mcthaydt/automata-content/schema'),
  }
}

/** The options the config exports as `contentConfig` (or as its default), or why it cannot be read. */
export function loadContentConfig(
  source: string,
  modules: ConfigModules,
):
  | { readonly ok: true; readonly options: CompileOptions }
  | { readonly ok: false; readonly message: string } {
  try {
    const { code } = transform(source, {
      transforms: ['typescript', 'imports'],
      disableESTransforms: true,
    })
    const exports: Record<string, unknown> = {}
    const load = (specifier: string): unknown => {
      if (!(specifier in modules)) throw new Error(`it imports ${specifier}, which the app can't read`)
      return modules[specifier]
    }
    new Function('exports', 'require', code)(exports, load)
    const options = exports.contentConfig ?? exports.default
    if (typeof options !== 'object' || options === null || !('schemas' in options))
      return { ok: false, message: 'it does not export contentConfig' }
    return { ok: true, options: options as CompileOptions }
  } catch (error) {
    return { ok: false, message: String((error as Error).message ?? error) }
  }
}
