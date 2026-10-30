<!--
  The display covers for the layout contracts (M4 spec §4.9, §7, M4.7): the landscape gate in each of its states, and
  the rotate hint, each over a screen as a game would draw it. Words are English stand-ins of a typical length, said in the `locale`
  the contract runs in.
-->
<script lang="ts" module>
export const DISPLAY_SHOWS = ['gate-fullscreen', 'gate-upright', 'rotate'] as const
export type DisplayShow = (typeof DISPLAY_SHOWS)[number]
</script>

<script lang="ts">
import LandscapeGate from '../display/LandscapeGate.svelte'
import RotateHint from '../display/RotateHint.svelte'
import ScreenFrame from '../layout/ScreenFrame.svelte'
import { type FixtureLocale, say } from './locale-fixture'

const { show, locale = 'en' }: { show: DisplayShow; locale?: FixtureLocale } = $props()
/** A word in the contract's locale, as a game's `t()` would give it. A fixture's props are fixed for its mount. */
const t = (text: string): string => say(locale, text)
const none = (): void => undefined
const GATE_COPY = {
  title: t('Play fullscreen'),
  body: t('Your browser’s bar takes too much of the screen sideways. One tap hides it.'),
  go: t('Go fullscreen'),
  uprightTitle: t('Turn your phone upright'),
  uprightBody: t('Or add the game to your Home Screen to play it sideways.'),
}
</script>

<ScreenFrame arrangement="stack" back={none} backLabel={t('Back')}>
  {#snippet body()}<p style="margin: 0">{t('The game')}</p>{/snippet}
</ScreenFrame>

{#if show === 'rotate'}
  <RotateHint shown copy={{ title: t('Turn your phone'), body: t('This game plays in landscape.') }} />
{:else}
  <LandscapeGate state={show === 'gate-fullscreen' ? 'fullscreen' : 'rotate-or-install'} copy={GATE_COPY} onfullscreen={none} />
{/if}
