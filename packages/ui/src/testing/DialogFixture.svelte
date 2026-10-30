<!--
  A confirm dialog for the layout contracts (M1.6 plan Task 11): a title, a paragraph, two actions, said in the
  `locale` the contract runs in.
-->
<script lang="ts">
import Dialog from '../dialog/Dialog.svelte'
import { type FixtureLocale, say } from './locale-fixture'

const { locale = 'en' }: { locale?: FixtureLocale } = $props()
/** A word in the contract's locale, as a game's `t()` would give it. A fixture's props are fixed for its mount. */
const t = (text: string): string => say(locale, text)
const none = (): void => undefined
</script>

<Dialog title={t('Delete this save?')} onclose={none}>
  <p style="margin: 0">
    {t(
      'Your progress in this slot will be gone for good. Other slots are not touched, and you can start a new game here at any time.',
    )}
  </p>
  {#snippet actions()}
    <button type="button" class="af-control" data-testid="dialog-cancel" data-initial-focus>{t('Keep it')}</button>
    <button type="button" class="af-control af-control--primary" data-kind="primary" data-testid="dialog-confirm">{t('Delete')}</button>
  {/snippet}
</Dialog>
