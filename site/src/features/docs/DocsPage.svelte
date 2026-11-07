<script lang="ts">
import CodeBlock from '../../shared/components/CodeBlock.svelte'
import InlineText from '../../shared/components/InlineText.svelte'
import PageMeta from '../../shared/components/PageMeta.svelte'
import { parseMarkdown } from '../../shared/utils/markdown'
import { getDocs } from './docs-loader'

// One guide, with every guide beside it. There are a handful, so the list is the navigation: no search box of its
// own (the header's search finds words inside them). `/docs` with no slug shows the first, How it works.
let { slug }: { slug?: string } = $props()
const docs = getDocs()
let active = $derived(docs.find((d) => d.slug === slug) ?? docs[0])
let blocks = $derived(parseMarkdown(active.content))
let index = $derived(docs.indexOf(active))
let previous = $derived(docs[index - 1])
let next = $derived(docs[index + 1])
</script>
<PageMeta title={active.title} description={active.description} />
<div class="page-shell docs-layout">
  <aside class="docs-sidebar">
    {#snippet guideLinks()}<nav aria-label="Guides">{#each docs as doc}<a href={'/docs/' + doc.slug} aria-current={active.slug === doc.slug ? 'page' : undefined}>{doc.title}</a>{/each}</nav>{/snippet}
    <div class="desktop-doc-links">{@render guideLinks()}</div>
    <!-- On a phone the list folds away above the guide; only one of the two copies is ever shown. -->
    <details class="mobile-doc-links"><summary>All guides</summary>{@render guideLinks()}</details>
  </aside>
  <article class="doc-content"><h1>{active.title}</h1>
    {#each blocks as block}
      {#if block.type === 'h2'}<h2 id={block.headingId}>{block.content}</h2>
      {:else if block.type === 'h3'}<h3 id={block.headingId}>{block.content}</h3>
      {:else if block.type === 'code'}<CodeBlock code={block.code ?? ''} lang={block.lang} />
      {:else if block.type === 'callout'}<aside data-callout={block.calloutType} class="callout"><p><InlineText text={block.content} /></p></aside>
      {:else if block.type === 'table'}<!-- Keyboard access to horizontally overflowing tables. -->
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <div class="table-scroll" tabindex="0" role="region" aria-label={'Table in ' + active.title}><table><thead><tr>{#each block.tableHeaders ?? [] as cell}<th scope="col"><InlineText text={cell} /></th>{/each}</tr></thead><tbody>{#each block.tableRows ?? [] as row}<tr>{#each row as cell}<td><InlineText text={cell} /></td>{/each}</tr>{/each}</tbody></table></div>
      {:else if block.type === 'ul'}<ul>{#each block.listItems ?? [] as item}<li><InlineText text={item} /></li>{/each}</ul>
      {:else if block.type === 'ol'}<ol>{#each block.listItems ?? [] as item}<li><InlineText text={item} /></li>{/each}</ol>
      {:else}<p><InlineText text={block.content} /></p>{/if}
    {/each}
    <nav class="doc-pagination" aria-label="Previous and next guide">{#if previous}<a href={'/docs/' + previous.slug}>Previous: {previous.title}</a>{/if}{#if next}<a href={'/docs/' + next.slug}>Next: {next.title}</a>{/if}</nav>
  </article>
  {#if active.toc.length}<aside class="doc-toc"><nav aria-label="On this page"><p><strong>On this page</strong></p>{#each active.toc as heading}<a href={'#' + heading.id}>{heading.text}</a>{/each}</nav></aside>{/if}
</div>
