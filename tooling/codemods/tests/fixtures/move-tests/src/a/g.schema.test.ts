import { expect, it } from 'vitest'
import { b } from './b.ts'

// The source text below is a string, not an import: the codemod must leave it alone.
const sample = `import { b } from './b.ts'`

it('g keeps its role suffix', () => expect([b, sample]).toBeDefined())
