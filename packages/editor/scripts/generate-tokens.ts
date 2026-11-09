// Writes src/shared/kit/tokens.css from src/shared/kit/tokens/tokens.json. Run it after editing the JSON:
//   pnpm --filter @automataframework/automata-editor tokens
// With --check it writes nothing and exits 1 when tokens.css is stale (tokens.test.ts runs it).
import { readFileSync, writeFileSync } from 'node:fs'
import type { EditorTokens } from '../src/shared/kit/tokens/editor-tokens.ts'
import { tokensToCss } from '../src/shared/kit/tokens/tokens-to-css.ts'

const source = new URL('../src/shared/kit/tokens/tokens.json', import.meta.url)
const target = new URL('../src/shared/kit/tokens.css', import.meta.url)
const css = tokensToCss(JSON.parse(readFileSync(source, 'utf8')) as EditorTokens)

if (process.argv.includes('--check')) {
  if (readFileSync(target, 'utf8') !== css) {
    console.error('tokens.css is stale. Run: pnpm --filter @automataframework/automata-editor tokens')
    process.exit(1)
  }
} else {
  writeFileSync(target, css)
}
