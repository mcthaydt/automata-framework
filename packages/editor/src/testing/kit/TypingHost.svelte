<!-- Mounts one widget under a typing registry the test owns, as the suite does, so a draft can be offered back. -->
<script lang="ts">
import type { TypingDrafts } from '../../shared/kit/storage/typing-drafts'
import ColorField from '../../shared/kit/widgets/ColorField.svelte'
import Stepper from '../../shared/kit/widgets/Stepper.svelte'
import { setTypingDrafts } from '../../shared/kit/widgets/typing-context'

interface Props {
  drafts: TypingDrafts
  widget: 'stepper' | 'color'
  value: number | string
  onnumber?: (value: number) => void
  oncolor?: (value: string) => void
}

const { drafts, widget, value, onnumber, oncolor }: Props = $props()
// svelte-ignore state_referenced_locally
setTypingDrafts(drafts)
</script>

{#if widget === 'stepper'}
  <Stepper label="HP" value={Number(value)} min={1} max={99} onedit={(event) => onnumber?.(event.value)} />
{:else}
  <ColorField label="Tint" value={String(value)} palette={['#ff0000', '#00ff00']} onedit={(event) => oncolor?.(event.value)} />
{/if}
