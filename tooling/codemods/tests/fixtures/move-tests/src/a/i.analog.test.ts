import { expect, it } from 'vitest'
import { b } from './b.ts'

it('i analog keeps its qualifier on a clash', () => expect(b).toBe(1))
