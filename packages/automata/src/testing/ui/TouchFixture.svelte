<!--
  The touch buttons for the layout contracts: a play screen's frame with Pause in its corner and the
  buttons in the frame's actions row, as the default play screen puts them. `with-bar` puts an ActionBar above them
  and four buttons, the movement and Drop required and an Emote not, as a game's own screen might (D-a): where they
  do not all fit at the primary size, only the required ones show. Words are said in the `locale` the contract runs
  in; the arrows are symbols, the same in every language.
-->
<script lang="ts">
import ActionBar from '../../shared/ui/layout/ActionBar.svelte'
import ScreenFrame from '../../shared/ui/layout/ScreenFrame.svelte'
import TouchControls from '../../shared/ui/touch/TouchControls.svelte'
import { type FixtureLocale, say } from './locale-fixture'

const { show = 'default', locale = 'en' }: { show?: 'default' | 'with-bar'; locale?: FixtureLocale } =
  $props()
/** A word in the contract's locale, as a game's `t()` would give it. A fixture's props are fixed for its mount. */
const t = (text: string): string => say(locale, text)
const none = (): void => undefined
</script>

<ScreenFrame arrangement="stack" back={none} backLabel={t('Pause')}>
  {#snippet body()}<p>{t('Play')}</p>{/snippet}
  {#snippet actions()}
    {#if show === 'with-bar'}
      <div style="display: grid; gap: 8px">
        <ActionBar
          actions={[
            { id: 'bar-ready', label: t('Ready'), kind: 'primary', onSelect: none },
            { id: 'bar-leave', label: t('Leave the race'), shortLabel: t('Leave'), kind: 'secondary', onSelect: none },
          ]}
        />
        <TouchControls
          buttons={[
            { action: 'touch-left', label: '←', ariaLabel: t('Move left'), required: true },
            { action: 'touch-right', label: '→', ariaLabel: t('Move right'), required: true },
            { action: 'touch-emote', label: t('Wave hello'), side: 'end' },
            { action: 'touch-drop', label: t('Drop'), side: 'end', required: true },
          ]}
          onhold={none}
          onrelease={none}
        />
      </div>
    {:else}
      <TouchControls
        buttons={[
          { action: 'touch-left', label: '←', ariaLabel: t('Move left') },
          { action: 'touch-right', label: '→', ariaLabel: t('Move right') },
          { action: 'touch-drop', label: t('Drop'), side: 'end' },
        ]}
        onhold={none}
        onrelease={none}
      />
    {/if}
  {/snippet}
</ScreenFrame>
