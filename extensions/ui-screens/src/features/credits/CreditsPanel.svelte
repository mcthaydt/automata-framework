<!--
  @component
  The credits: core's Modal around sections of names, each with a role and, where the game gives one, a link. The
  Modal's body is the declared scroll region, so any number of names fits a phone with Close always in reach. A name with
  a link is a button, at least 44 px, only where the host granted `links`; without the grant it is plain text, so there
  is never a control that cannot work. Pressing it asks the host (`hosting.openLink`); the panel never opens a window or
  touches the page's location. A link the host or the player refused is said politely under the list, and the panel
  stays open. `text` is the game's lookup for translated titles and roles; a name is a person's and is never looked up.
  A copy of this folder in a game works alone and takes its words as props.
-->
<script lang="ts">
import { type Hosting, Modal } from '@automata/framework'

/** One person or group. `role` and `url` are optional. */
interface CreditName {
  readonly name: string
  readonly role?: string | undefined
  readonly url?: string | undefined
}

interface CreditsSection {
  readonly title: string
  readonly names: readonly CreditName[]
}

interface Props {
  /** The game's credits file. */
  credits: { readonly sections: readonly CreditsSection[] }
  copy: {
    readonly title: string
    readonly close: string
    /** What a screen reader says for a name that links to a page. */
    readonly opens: (name: string) => string
    /** Said when a link could not be opened. */
    readonly refused: string
  }
  onClose: () => void
  /** The host: asked to open links, and whether it may. */
  hosting: Pick<Hosting, 'openLink' | 'granted'>
  /**
   * The game's lookup for a section's title (`name` undefined) or a name's role, by position, given what the file says;
   * the default returns the file's own words.
   */
  text?: ((section: number, name: number | undefined, authored: string) => string) | undefined
}

const { credits, copy, onClose, hosting, text = (_section, _name, authored) => authored }: Props = $props()

const canOpen = $derived(hosting.granted.has('links'))
/** True after a link the host or the player turned down; cleared by the next attempt. */
let refused = $state(false)

async function open(url: string): Promise<void> {
  refused = false
  const answer = await hosting.openLink(url)
  refused = !answer.ok || !answer.value.opened
}
</script>

<Modal title={copy.title} closeLabel={copy.close} onclose={onClose} testId="credits-panel">
  {#each credits.sections as section, s (s)}
    <section class="credits__section">
      <h3 class="credits__title">{text(s, undefined, section.title)}</h3>
      <ul class="credits__names">
        {#each section.names as person, n (n)}
          <li class="credits__row">
            {#if person.url !== undefined && canOpen}
              {@const url = person.url}
              <button
                type="button"
                class="af-control af-control--ghost credits__link"
                data-testid={`credits-link-${s}-${n}`}
                aria-label={copy.opens(person.name)}
                onclick={() => void open(url)}
              >
                <span class="credits__name">{person.name}</span>
                {#if person.role !== undefined}<span class="credits__role">{text(s, n, person.role)}</span>{/if}
              </button>
            {:else}
              <span class="credits__plain">
                <span class="credits__name">{person.name}</span>
                {#if person.role !== undefined}<span class="credits__role">{text(s, n, person.role)}</span>{/if}
              </span>
            {/if}
          </li>
        {/each}
      </ul>
    </section>
  {/each}
  {#snippet actions()}
    <!-- Always present, so a screen reader hears the refusal when it appears; empty when there is none. -->
    <p class="credits__note" role="status" aria-live="polite" data-testid="credits-note">{refused ? copy.refused : ''}</p>
  {/snippet}
</Modal>

<style>
  .credits__section + .credits__section {
    margin-top: calc(var(--af-gutter) * 1.5);
  }

  .credits__title {
    margin: 0 0 8px;
    font: 700 calc(16px * var(--af-scale, 1)) / 1.3 var(--af-font);
    overflow-wrap: anywhere;
  }

  .credits__names {
    display: grid;
    gap: 4px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  /* A link is a whole row, so it is easy to hit; a plain name keeps the same height so the list does not jump. */
  .credits__link,
  .credits__plain {
    box-sizing: border-box;
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: flex-start;
    gap: 2px 10px;
    width: 100%;
    min-height: var(--af-target);
    padding: 8px 12px;
    text-align: start;
    overflow-wrap: anywhere;
  }

  .credits__plain {
    align-content: center;
  }

  .credits__link {
    align-items: center;
  }

  .credits__role {
    opacity: 0.75;
    font-weight: 400;
  }

  .credits__note {
    flex: 1 1 100%;
    margin: 0;
    min-height: 0;
    text-align: start;
    overflow-wrap: anywhere;
  }

  .credits__note:empty {
    display: none;
  }
</style>
