import { expect, it } from 'vitest'
import { helper } from '../testing/helper.ts'
import { b } from './b.ts'

it('b', () => expect(b + helper).toBe(2))
