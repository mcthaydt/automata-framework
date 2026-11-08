<!--
  "New level": the kit's dialog (a bottom sheet on a phone) holding the template cards. Choosing one closes the sheet
  and makes the level, which then opens; Cancel, Escape or a tap outside keep Home as it was. Where the new level is
  kept is the app's business (on a game folder, the folder the game keeps its levels in).
-->
<script lang="ts">
import Button from '../../shared/kit/widgets/Button.svelte'
import Dialog from '../../shared/kit/widgets/Dialog.svelte'
import type { TemplateCard } from './home-model'
import TemplateRow from './TemplateRow.svelte'

interface Props {
  open: boolean
  cards: readonly TemplateCard[]
  busy: boolean
  oncreate: (profileId: string, templateId: string) => void
}

let { open = $bindable(), cards, busy, oncreate }: Props = $props()
</script>

<Dialog bind:open title="New level">
  <p>Pick a starting point. You can change everything later.</p>
  <TemplateRow
    {cards}
    {busy}
    oncreate={(profileId, templateId) => {
      open = false
      oncreate(profileId, templateId)
    }}
  />
  {#snippet actions({ close })}
    <Button onclick={close}>Cancel</Button>
  {/snippet}
</Dialog>

<style>
  p {
    margin: 0 0 var(--space-3);
    color: var(--muted);
  }
</style>
