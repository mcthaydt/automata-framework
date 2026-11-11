<!--
  The first run's screens for the layout contracts: `language` is the language screen with all six languages; `warning`
  is the photosensitivity warning with two switches. Words are the default English words, said in the `locale` the
  contract runs in.
-->
<script lang="ts" module>
export const FIRST_RUN_SHOWS = ['language'] as const
export type FirstRunShow = (typeof FIRST_RUN_SHOWS)[number]
</script>

<script lang="ts">
import LanguageFirst from '../../app/opening/LanguageFirst.svelte'
import { DEFAULT_SCREENS_COPY, type ScreensCopy } from '../../app/screens/screens-copy'
import { type FixtureLocale, say } from './locale-fixture'

const { show, locale = 'en' }: { show: FirstRunShow; locale?: FixtureLocale } = $props()

/** A word in the contract's locale. A fixture's props are fixed for its mount. */
const t = (text: string): string => say(locale, text)
const words = DEFAULT_SCREENS_COPY.firstRun
const copy: ScreensCopy = {
  ...DEFAULT_SCREENS_COPY,
  firstRun: {
    language: { title: t(words.language.title), close: t(words.language.close) },
    warning: words.warning,
  },
}
const live = { current: copy }
const none = (): void => undefined
</script>

{#if show === 'language'}
  <LanguageFirst
    locales={['en', 'ja', 'ko', 'es-419', 'pt-BR', 'zh-Hans']}
    detected="ko"
    copy={live}
    onpick={none}
    onclose={none}
  />
{/if}
