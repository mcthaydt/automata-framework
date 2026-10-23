// Writes src/tokens.css from docs/design/editor-kit/tokens.json. Run it after editing the JSON:
//   pnpm --filter @mcthaydt/automata-editor-kit tokens
// tokens.test.ts fails when the two have drifted apart.
import { readFileSync, writeFileSync } from 'node:fs'
import type { EditorTokens } from '../src/tokens/editor-tokens.ts'
import { tokensToCss } from '../src/tokens/tokens-to-css.ts'

const source = new URL('../../../docs/design/editor-kit/tokens.json', import.meta.url)
const target = new URL('../src/tokens.css', import.meta.url)

writeFileSync(target, tokensToCss(JSON.parse(readFileSync(source, 'utf8')) as EditorTokens))
