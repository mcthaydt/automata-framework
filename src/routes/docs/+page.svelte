<script lang="ts">
  import CodeBlock from '$lib/components/CodeBlock.svelte'
  import PageMeta from '$lib/components/PageMeta.svelte'
  import { parseMarkdown } from '$lib/utils/markdown'
  import { isEditing } from '$lib/utils/keyboard'
  import { getDocSections, getDocCategories } from '../../data/docs-loader'
  let { slug }: { slug?: string } = $props()
  const docs = getDocSections()
  let query = $state('')
  let input: HTMLInputElement
  let active = $derived(docs.find(d => d.slug === slug) ?? docs[0])
  let blocks = $derived(parseMarkdown(active.content))
  let index = $derived(docs.indexOf(active))
  let categories = $derived(getDocCategories().map(cat => ({ ...cat, items: cat.items.filter(d => query.trim().toLowerCase().split(/\s+/).every(q => (d.title + ' ' + d.description + ' ' + d.content).toLowerCase().includes(q))) })).filter(cat => cat.items.length))
  function keydown(event: KeyboardEvent) { if (event.key === '/' && !isEditing(event)) { event.preventDefault(); input.focus() } }
</script>
<svelte:window onkeydown={keydown} />
<PageMeta title={active.title} description={active.description} />
<div class="page-shell docs-layout">
  <aside class="docs-sidebar" aria-label="Documentation navigation">
    <label for="docs-search">Search docs</label><input bind:this={input} id="docs-search" type="search" bind:value={query} placeholder="Search docs..." />
    {#snippet sectionLinks()}<nav>{#each categories as category}<div><p><strong>{category.name}</strong></p>{#each category.items as item}<a href={'/docs/' + item.slug} aria-current={active.slug === item.slug ? 'page' : undefined}>{item.title}</a>{/each}</div>{/each}</nav>{/snippet}
    <div class="desktop-doc-links">{@render sectionLinks()}</div>
    <details class="mobile-doc-links"><summary>Browse sections</summary>{@render sectionLinks()}</details>
    {#if !categories.length}<p role="status">No matching sections. Try another topic.</p>{/if}
  </aside>
  <article class="doc-content"><h1>{active.title}</h1><p class="lead">{active.description}</p>
    {#each blocks as block}
      {#if block.type === 'h2'}<h2 id={block.headingId}>{block.content}</h2>
      {:else if block.type === 'h3'}<h3 id={block.headingId}>{block.content}</h3>
      {:else if block.type === 'code'}<CodeBlock code={block.code ?? ''} lang={block.lang} />
      {:else if block.type === 'callout'}<aside data-callout={block.calloutType} class="callout"><p>{block.content}</p></aside>
      {:else if block.type === 'table'}<!-- Keyboard access to horizontally overflowing tables. -->
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <div class="table-scroll" tabindex="0" role="region" aria-label="Documentation table"><table><thead><tr>{#each block.tableHeaders ?? [] as cell}<th scope="col">{cell}</th>{/each}</tr></thead><tbody>{#each block.tableRows ?? [] as row}<tr>{#each row as cell}<td>{cell}</td>{/each}</tr>{/each}</tbody></table></div>
      {:else if block.type === 'ul'}<ul>{#each block.listItems ?? [] as item}<li>{item}</li>{/each}</ul>
      {:else if block.type === 'ol'}<ol>{#each block.listItems ?? [] as item}<li>{item}</li>{/each}</ol>
      {:else}<p>{block.content}</p>{/if}
    {/each}
    <nav class="doc-pagination" aria-label="Previous and next documentation">{#if index > 0}<a href={'/docs/' + docs[index - 1].slug}>Previous: {docs[index - 1].title}</a>{/if}{#if index < docs.length - 1}<a href={'/docs/' + docs[index + 1].slug}>Next: {docs[index + 1].title}</a>{/if}</nav>
  </article>
  <aside class="doc-toc"><nav aria-label="On this page"><p><strong>On this page</strong></p>{#each active.toc as heading}<a href={'#' + heading.id}>{heading.text}</a>{/each}</nav></aside>
</div>
