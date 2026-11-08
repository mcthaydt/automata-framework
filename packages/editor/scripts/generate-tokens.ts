// Writes src/shared/kit/tokens.css from src/shared/kit/tokens/tokens.json. Run it after editing the JSON:
//   pnpm --filter @mcthaydt/automata-editor tokens
// tokens.test.ts fails when the two have drifted apart.
import { readFileSync, writeFileSync } from 'node:fs'
import type { EditorTokens } from '../src/shared/kit/tokens/editor-tokens.ts'
import { tokensToCss } from '../src/shared/kit/tokens/tokens-to-css.ts'

const source = new URL('../src/shared/kit/tokens/tokens.json', import.meta.url)
const target = new URL('../src/shared/kit/tokens.css', import.meta.url)

writeFileSync(target, tokensToCss(JSON.parse(readFileSync(source, 'utf8')) as EditorTokens))
