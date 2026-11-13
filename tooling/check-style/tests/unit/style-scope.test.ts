import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, it } from 'vitest'

/**
 * The root `style` script lists by hand the folders each rule scans, so a new package is outside
 * every rule until someone adds it. These tests read the script itself and pin the packages that
 * must be inside: a rule that does not scan a folder cannot fail on it.
 */
const ROOT = join(import.meta.dirname, '../../../..')
const script: string = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).scripts.style

/** The paths after a flag, up to the next flag or the next `&&` command ('' is the bare rule). */
function pathsOf(flag: '' | '--plan-comments' | '--comments-only' | '--test-imports'): string[] {
  const out: string[] = []
  for (const command of script.split('&&')) {
    const words = command.trim().split(/\s+/)
    if (words[0] !== 'node' || !words[1]?.includes('check-style')) continue
    const args = words.slice(2)
    let current = ''
    for (const word of args) {
      if (word.startsWith('--')) current = word
      else if (current === flag) out.push(word)
    }
  }
  return out
}

it('scans examples/set-3d for the size and kind rules, the plan-comment rule and the test-import rule', () => {
  expect(pathsOf('')).toContain('examples/set-3d/src')
  expect(pathsOf('--plan-comments')).toContain('examples/set-3d/src')
  expect(pathsOf('--test-imports')).toContain('examples/set-3d')
})
