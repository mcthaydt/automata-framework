import { describe, expect, test } from 'vitest'
import { mountFixture } from './mount'
import SnippetHost from './SnippetHost.test.svelte'
import { textSnippet } from './text-snippet'

describe('mountFixture', () => {
  test('mounts a component with its props into a fresh target in the body, and removes both', async () => {
    const fixture = mountFixture(SnippetHost, { content: textSnippet('Ready', 'p') })
    expect(fixture.target.isConnected).toBe(true)
    expect(fixture.target.textContent).toBe('Ready')
    await fixture.unmount()
    expect(fixture.target.isConnected).toBe(false)
  })

  test('uses the target it is given and leaves it in place', async () => {
    const target = document.createElement('section')
    document.body.append(target)
    const fixture = mountFixture(SnippetHost, { content: textSnippet('Go', 'p') }, target)
    expect(target.textContent).toBe('Go')
    await fixture.unmount()
    expect(target.isConnected).toBe(true)
    expect(target.textContent).toBe('')
    target.remove()
  })
})
