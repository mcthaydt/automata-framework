import { expect, it } from 'vitest'
import { b } from './b.ts'

it('b in every engine', () => expect(b).toBe(1))
