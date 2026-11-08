<!--
  A representative screen for the layout contracts: every frame part in use.
  Back and a corner control, a header, a hero, a list of rows that keeps two whole, and an action
  bar with a primary, a secondary and a utility. Stack on a portrait form factor, split otherwise,
  as a screen root would choose. Words are said in the `locale` the contract runs in.
-->
<script lang="ts">
import ActionBar from '../../shared/ui/layout/ActionBar.svelte'
import type { BarAction } from '../../shared/ui/layout/action-bar'
import ScreenFrame from '../../shared/ui/layout/ScreenFrame.svelte'
import ScrollList from '../../shared/ui/layout/ScrollList.svelte'
import { type FixtureLocale, say } from './locale-fixture'

const { arrangement, locale = 'en' }: { arrangement: 'stack' | 'split'; locale?: FixtureLocale } = $props()
/** A word in the contract's locale, as a game's `t()` would give it. A fixture's props are fixed for its mount. */
const t = (text: string): string => say(locale, text)

const ROWS = ['Forest', 'Cave', 'Tower', 'Lake', 'Ruins', 'Summit', 'Harbour', 'Garden']
const none = (): void => undefined
const barActions: BarAction[] = [
  { id: 'play', label: t('Play'), kind: 'primary', onSelect: none },
  { id: 'settings', label: t('Settings'), shortLabel: t('Set'), kind: 'secondary', onSelect: none },
  { id: 'help', label: t('Help'), kind: 'utility', onSelect: none },
]
</script>

<ScreenFrame {arrangement} back={none} backLabel={t('Back')} testId="screen">
  {#snippet header()}<span data-testid="screen-title">{t('Choose a level')}</span>{/snippet}
  {#snippet end()}<button type="button" class="af-control af-control--ghost" data-testid="mute">{t('Mute')}</button>{/snippet}
  {#snippet hero()}<div data-testid="hero" style="width: 100%; height: 100%; min-height: 0; background: var(--af-panel)"></div>{/snippet}
  {#snippet body()}
    <ScrollList minRows={2} rowCount={ROWS.length} rowGap="8px" label={t('Levels')} moreLabel={(n) => t(`+${n} more`)} testId="levels">
      <div style="display: grid; gap: 8px">
        {#each ROWS as row (row)}
          <button type="button" class="af-control" data-row data-testid={`row-${row}`} style="width: 100%">{t(row)}</button>
        {/each}
      </div>
    </ScrollList>
  {/snippet}
  {#snippet actions()}<ActionBar actions={barActions} testId="actions" />{/snippet}
</ScreenFrame>
