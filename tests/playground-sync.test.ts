// @vitest-environment node
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { copyHeader, PLAYGROUND_COPIES } from '../scripts/sync-playground'

// The site uses the framework's playground protocol and header rule unchanged (spec §5.1, §11.3): each copy is the
// framework file at framework.ref, under one line naming it.
const ref = readFileSync(resolve('framework.ref'), 'utf8').trim()
const atRef = (path: string) =>
  execFileSync('git', ['-C', resolve('../automata-framework'), 'show', `${ref}:${path}`], { encoding: 'utf8' })

describe('the playground copies', () => {
  for (const { from, to } of PLAYGROUND_COPIES) {
    it(`${to} is ${from} at framework.ref, verbatim`, () => {
      expect(readFileSync(resolve(to), 'utf8')).toBe(`${copyHeader(ref, from)}\n${atRef(from)}`)
    })
  }
})
