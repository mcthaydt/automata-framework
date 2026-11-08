// Writes src/shared/kit/tokens.css from tokens/tokens.json and src/shared/kit/tool-theme.css from tokens/tool-theme.json.
// Run it after editing either JSON:
//   pnpm --filter @automata/editor tokens
// With --check it writes nothing and exits 1 when either file is stale (tokens.test.ts and tool-theme.test.ts run it).
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import type { EditorTokens, ToolTheme } from '../src/shared/kit/tokens/editor-tokens.ts'
import { tokensToCss } from '../src/shared/kit/tokens/tokens-to-css.ts'
import { toolThemeToCss } from '../src/shared/kit/tokens/tool-theme-to-css.ts'

const read = (url: URL): unknown => JSON.parse(readFileSync(url, 'utf8'))
const files = [
  {
    target: new URL('../src/shared/kit/tokens.css', import.meta.url),
    css: tokensToCss(read(new URL('../src/shared/kit/tokens/tokens.json', import.meta.url)) as EditorTokens),
  },
  {
    target: new URL('../src/shared/kit/tool-theme.css', import.meta.url),
    css: toolThemeToCss(
      read(new URL('../src/shared/kit/tokens/tool-theme.json', import.meta.url)) as ToolTheme,
    ),
  },
]

if (process.argv.includes('--check')) {
  const stale = files.filter(({ target, css }) => !existsSync(target) || readFileSync(target, 'utf8') !== css)
  if (stale.length > 0) {
    console.error(
      `${stale.map(({ target }) => target.pathname.split('/').pop()).join(' and ')} is stale. Run: pnpm --filter @automata/editor tokens`,
    )
    process.exit(1)
  }
} else {
  for (const { target, css } of files) writeFileSync(target, css)
}
