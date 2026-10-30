import { describe, expect, it } from 'vitest'
import { offsetIn } from '../../src/lib/playground/caret'

// The static code is one span per line holding highlighted pieces; the line numbers are CSS counters, not text.
function staticCode(): HTMLElement {
  const pre = document.createElement('pre')
  pre.innerHTML = '<code><span class="line"><span class="tok-keyword">const</span> a = 1\n</span><span class="line"><span class="tok-keyword">let</span> bee = 2</span></code>'
  document.body.append(pre)
  return pre
}

describe('offsetIn', () => {
  it('counts the source characters before a position inside a highlighted piece', () => {
    const pre = staticCode()
    const bee = pre.querySelectorAll('.line')[1].childNodes[1]
    expect(offsetIn(pre, bee, 3)).toBe('const a = 1\nlet be'.length)
  })

  it('counts a position given as an element and a child index', () => {
    const pre = staticCode()
    expect(offsetIn(pre, pre.querySelectorAll('.line')[1], 1)).toBe('const a = 1\nlet'.length)
    expect(offsetIn(pre, pre, 0)).toBe(0)
  })

  it('gives null for a position outside the code', () => {
    const pre = staticCode()
    expect(offsetIn(pre, document.body, 0)).toBeNull()
  })
})
