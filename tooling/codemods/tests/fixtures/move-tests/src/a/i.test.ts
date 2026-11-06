import { expect, it } from 'vitest'
import { b } from './b.ts'

// A published helper (Host.published.test.svelte below) is imported by src/testing, so it stays in src.
it('i', () => expect(b).toBe(1))
