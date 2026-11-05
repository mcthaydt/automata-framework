import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'
import { b } from './b.js'
import data from './data.json'

const packageRoot = fileURLToPath(new URL('../..', import.meta.url))

it('k reaches the package root and a json file', () => expect([b, data, packageRoot]).toBeDefined())
