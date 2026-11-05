import { flushSync, mount, unmount } from 'svelte'
import { expect, test } from 'vitest'
import { textSnippet } from '#src/testing/fixtures/text-snippet.ts'
import SnippetHost from '../../../fixtures/testing/fixtures/SnippetHost.test.svelte'

test('renders text in a tag, escaped by default', () => {
  const target = document.createElement('div')
  const app = mount(SnippetHost, { target, props: { content: textSnippet('a < b', 'p') } })
  flushSync()
  expect(target.innerHTML).toContain('<p>a &lt; b</p>')
  unmount(app)
})

test('renders trusted markup when asked, for fixture rows', () => {
  const target = document.createElement('div')
  const app = mount(SnippetHost, { target, props: { content: textSnippet('<li>1</li>', 'ol', true) } })
  flushSync()
  expect(target.querySelector('ol > li')?.textContent).toBe('1')
  unmount(app)
})
