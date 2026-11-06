import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'
import { b } from './b.js'
import data from './data.json'

const packageRoot = fileURLToPath(new URL('../..', import.meta.url))

it('k reaches the package root and a json file', () => expect([b, data, packageRoot]).toBeDefined())

const dataFile = join(import.meta.dirname, './data.json')
void dataFile
const here = join(import.meta.dirname, '.')
const moduleType: typeof import('./b') | undefined = undefined
void [here, moduleType]
const page = "new URL('./b.ts', import.meta.url)"
void page
