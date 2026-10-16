// `pnpm docs:stack`: regenerates docs/stack.md from stack-cards.ts, docs/versions.md and the installed packages.
// stack-page.test.ts fails `pnpm check` until the committed page matches what this writes.

import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { collectStackFacts, renderStackPage } from './stack.ts'
import { STACK } from './stack-cards.ts'

const root = fileURLToPath(new URL('../../..', import.meta.url))
writeFileSync(join(root, 'docs/stack.md'), renderStackPage(STACK, collectStackFacts(root, STACK.cards)))
console.log('wrote docs/stack.md')
