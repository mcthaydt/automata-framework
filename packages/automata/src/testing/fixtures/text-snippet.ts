import { createRawSnippet, type Snippet } from 'svelte'

/**
 * A Svelte 5 snippet rendering `<tag>text</tag>`, so a test can pass `children`, `body` or an icon
 * to a component without writing a wrapper component (Ruken `packages/ui/src/test-snippets.ts`).
 * Text is escaped unless `trusted` is set, for fixture markup such as list rows.
 */
export function textSnippet(text: string, tag = 'span', trusted = false): Snippet {
  const content = trusted ? text : escapeHtml(text)
  return createRawSnippet(() => ({ render: () => `<${tag}>${content}</${tag}>` }))
}

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}
