import { expect, it } from 'vitest'
import { b } from './b'
import { sub } from './sub'

it('j leaves out extensions as the source did', () => expect(b + sub).toBe(2))
