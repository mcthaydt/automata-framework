<script lang="ts">
  import InlineText from '$lib/components/InlineText.svelte'
  import PageMeta from '$lib/components/PageMeta.svelte'
  import { stackSections, stackTitle } from '$lib/stack'
  import type { ParsedBlock } from '$lib/utils/markdown'
  import markdown from '../../data/stack.md?raw'

  // The framework's generated docs/stack.md, copied by `pnpm sync:stack` and held to the framework's file by
  // tests/stack-page.test.ts. This page lays it out and changes none of its words.
  const title = stackTitle(markdown)
  const { intro, sections } = stackSections(markdown)
</script>

{#snippet blocks(list: ParsedBlock[], tableLabel: string)}
  {#each list as block}
    {#if block.type === 'p'}
      <p><InlineText text={block.content ?? ''} /></p>
    {:else if block.type === 'ul'}
      <ul>{#each block.listItems ?? [] as item}<li><InlineText text={item} /></li>{/each}</ul>
    {:else if block.type === 'table'}
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <div class="table-scroll" tabindex="0" role="region" aria-label={tableLabel}>
        <table>
          <thead><tr>{#each block.tableHeaders ?? [] as header}<th scope="col"><InlineText text={header} /></th>{/each}</tr></thead>
          <tbody>{#each block.tableRows ?? [] as row}<tr>{#each row as cell}<td><InlineText text={cell} /></td>{/each}</tr>{/each}</tbody>
        </table>
      </div>
    {/if}
  {/each}
{/snippet}

<PageMeta title={title} description="The libraries Automata is built on, what each one does here, and its exact version and license, from the framework's own generated page." />
<!-- The framework's own words, laid out unchanged: site-checks leaves them to the framework (data-framework-copy). -->
<div class="page-shell inside-page" data-framework-copy>
  <h1>{title}</h1>
  <section class="inside-intro" aria-label="Overview">{@render blocks(intro, 'Libraries, tiers, versions and licenses')}</section>
  {#each sections as section (section.id)}
    <section class="inside-library" aria-labelledby={section.id}>
      <h2 id={section.id}>{section.title}</h2>
      {@render blocks(section.blocks, section.title + ' package, version and license')}
    </section>
  {/each}
</div>
