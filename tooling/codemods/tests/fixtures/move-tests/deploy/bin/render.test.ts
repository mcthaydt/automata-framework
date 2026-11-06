import { expect, it } from 'vitest'
import { b } from '../../src/a/b.ts'
import { render } from './render.ts'

it('render', () => expect(render + b).toBe(2))
