import { expect, it } from 'vitest'
import { b } from './b.ts'

it('h loses its qualifier', () => expect(b).toBe(1))
