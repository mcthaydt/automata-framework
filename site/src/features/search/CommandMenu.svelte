<script lang="ts">
import { tick } from 'svelte'
import type { ApiSearchRow } from '../../shared/framework/api'
import { latestApiVersion, loadApiSearch, searchApi } from '../../shared/framework/api-reference'
import { getExamples } from '../../shared/framework/example-catalog'
import type { SearchEntry } from './search-entry'

// The guides belong to the docs feature, so the layout passes them in (a feature never imports another).
let {
  isOpen = false,
  onClose = () => {},
  guides = [],
}: { isOpen?: boolean; onClose?: () => void; guides?: readonly SearchEntry[] } = $props()
let dialog: HTMLDialogElement
let input: HTMLInputElement
let query = $state('')
// The site's pages, its guides and its examples. API names come from the generated index below, so search never
// knows a name the packages do not export.
const PAGES: readonly SearchEntry[] = [
  { title: 'Home', detail: 'About Automata', url: '/' },
  { title: 'Start', detail: 'Make a game, play it, draw its level and put it online', url: '/start' },
  { title: 'Examples', detail: 'One-file examples that run beside their code', url: '/examples' },
  { title: 'Editor', detail: 'Draw your levels', url: '/editor' },
  { title: 'Docs', detail: 'Guides to the framework', url: '/docs' },
  { title: 'API reference', detail: 'Every export of every package', url: '/api' },
]
// Example titles are sentences; the id stays searchable through the detail line.
const EXAMPLES: readonly SearchEntry[] = getExamples().map((e) => ({
  title: e.title,
  detail: e.id + ' ' + e.shows,
  url: '/examples/' + e.id,
}))
// Pages, then the guides, then the examples, then API names: a question in plain words ("save", "level") meets a
// guide before it meets a function.
const links = $derived([...PAGES, ...guides, ...EXAMPLES])
let results = $derived(
  links.filter((l) =>
    query
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .every((q) => (l.title + ' ' + l.detail).toLowerCase().includes(q)),
  ),
)
// The complete generated reference loads the first time the menu opens, so a page that never searches does not carry it.
const apiVersion = latestApiVersion()
let apiRows = $state<ApiSearchRow[]>([])
let apiLoaded = false
const apiResults = $derived(
  searchApi(apiRows, query, 20).map((row) => ({
    title: row.name,
    detail: row.kind + ' in ' + row.package,
    url: '/api/' + apiVersion + '/' + row.package + '#' + row.name,
  })),
)
$effect(() => {
  if (!dialog) return
  if (isOpen) {
    const previous = document.activeElement as HTMLElement | null
    query = ''
    dialog.showModal()
    if (!apiLoaded) {
      apiLoaded = true
      void loadApiSearch(apiVersion).then((rows) => {
        apiRows = rows
      })
    }
    void tick().then(() => input?.focus())
    return () => {
      dialog.close()
      previous?.focus()
    }
  }
})
function keys(event: KeyboardEvent) {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
  event.preventDefault()
  const items = Array.from(dialog.querySelectorAll<HTMLAnchorElement>('.search-results a'))
  if (!items.length) return
  const index = items.indexOf(document.activeElement as HTMLAnchorElement)
  const next =
    index < 0
      ? event.key === 'ArrowDown'
        ? 0
        : items.length - 1
      : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
  items[next].focus()
}
</script>
<dialog bind:this={dialog} class="search-dialog" aria-labelledby="search-title" oncancel={(e) => { e.preventDefault(); onClose() }} onkeydown={keys}>
  <div class="dialog-heading"><h2 id="search-title">Search</h2><button type="button" onclick={onClose}>Close</button></div>
  <label for="site-search">Search pages, docs, API and demos</label>
  <input bind:this={input} id="site-search" type="search" bind:value={query} placeholder="Search, e.g. jump, save, level" />
  <div class="search-results">
    {#each results as item}<a href={item.url} onclick={onClose}>{item.title}</a>{/each}
    {#each apiResults as item}<a href={item.url} onclick={onClose}>{item.title} <span class="small">{item.detail}</span></a>{/each}
    {#if !results.length && !apiResults.length}<p role="status">Nothing found. Try another word.</p>{/if}
  </div>
  <p class="small">Use arrow keys to move, Enter to open, Escape to close.</p>
</dialog>
