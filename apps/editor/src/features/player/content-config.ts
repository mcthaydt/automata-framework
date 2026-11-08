import * as compile from '@mcthaydt/automata-content/compile'
import * as level2d from '@mcthaydt/automata-content/level-2d'
import * as palette from '@mcthaydt/automata-content/palette'
import * as schema from '@mcthaydt/automata-content/schema'
import { transform } from 'sucrase'
import { frameworkPackage } from '../../shared/framework-packages.ts'

// A game's `content.config.ts` is a plain file the app reads on a phone, where there is no Node and no Vite: it is
// stripped of types, turned into CommonJS and run against the browser-safe content entries the app carries. A file
// that imports anything else fails and says which import. The app's own compile worker runs it; a played game never does.

/** The content entries a config may import; the app passes the ones it carries. */
export type ConfigModules = Readonly<Record<string, unknown>>

/** The content package's browser entries as a config can import them. */
export function defaultConfigModules(): ConfigModules {
  return {
    [frameworkPackage('content', 'compile')]: compile,
    [frameworkPackage('content', 'level-2d')]: level2d,
    [frameworkPackage('content', 'palette')]: palette,
    [frameworkPackage('content', 'schema')]: schema,
  }
}

/** The options the config exports as `contentConfig` (or as its default), or why it cannot be read. */
export function loadContentConfig(
  source: string,
  modules: ConfigModules,
):
  | { readonly ok: true; readonly options: compile.CompileOptions }
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
    return { ok: true, options: options as compile.CompileOptions }
  } catch (error) {
    return { ok: false, message: String((error as Error).message ?? error) }
  }
}
