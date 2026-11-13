// The set's content for a Vite config: the plugin that compiles `content/` into `virtual:automata/content`, as a game's
// config does. The 3D examples' runner and this package's own tests both use it, and the story game will too, so the
// kinds the set reads are listed once, here. Node only: the page imports `./index.ts`.
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { worldPropContent, worldSwatchContent } from '@automata/3d/world-content'
import { automataContent } from '@automata/content/vite'
import { type Alias, type PluginOption, searchForWorkspaceRoot } from 'vite'

const SET_ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '../..')

/**
 * Where the set's `content/` is: its own folder, or, when an editor journey names a copy (`AF_E2E_CONTENT_ROOT`, which
 * the journey's dev server gets from `runGame`), that copy, so the page plays what the editor saved and the committed
 * files are never touched.
 */
export function setContentRootOf(env: Readonly<Record<string, string | undefined>>): string {
  return env.AF_E2E_CONTENT_ROOT ?? SET_ROOT
}

/**
 * The level file the code imports (`station.ts` reads it directly, for the zones) follows the copy as well; without a
 * copy there is nothing to change.
 */
export function setLevelAliasesOf(env: Readonly<Record<string, string | undefined>>): Alias[] {
  const copy = env.AF_E2E_CONTENT_ROOT
  if (copy === undefined) return []
  return [
    {
      find: /^.*\/content\/levels\/([^/]+\.af-sector\.json)$/,
      replacement: `${resolve(copy, 'content/levels')}/$1`,
    },
  ]
}

/**
 * The content plugin over the set's `content/` (its swatches and props, with the level file beside them), and the two
 * settings a copy outside the checkout needs: the level alias and a dev server that may read it.
 */
export function setContentPlugin(env: Readonly<Record<string, string | undefined>>): PluginOption {
  const root = setContentRootOf(env)
  return [
    automataContent({ root, schemas: [worldSwatchContent, worldPropContent] }),
    {
      name: 'set-3d:content-copy',
      config: () => ({
        resolve: { alias: setLevelAliasesOf(env) },
        ...(env.AF_E2E_CONTENT_ROOT === undefined
          ? {}
          : { server: { fs: { allow: [root, searchForWorkspaceRoot(process.cwd())] } } }),
      }),
    },
  ]
}
