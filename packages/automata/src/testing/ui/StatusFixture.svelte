<!--
  The status overlays for the layout contracts: the loader while
  assets arrive; the boot failure with the most words on its button (Continue without loading); a
  damaged model whose long file name has no break;
  an ErrorPanel with two ways forward, with a one-line message or a long one, and with three;
  and a final
  ErrorPanel (no way forward) with a long message. A failure is drawn over a screen with Back in
  its corner row, as a game would show it, so the contract can check Back stays reachable. Words are
  said in the `locale` the contract runs in; the boot failure's copy is the English defaults said so.
-->
<script lang="ts" module>
export type StatusShow =
  | 'loader'
  | 'boot-failure'
  | 'model-invalid'
  | 'error'
  | 'error-long'
  | 'error-three'
  | 'final-long'
</script>

<script lang="ts">
import ScreenFrame from '../../shared/ui/layout/ScreenFrame.svelte'
import BootFailurePanel from '../../shared/ui/status/BootFailurePanel.svelte'
import ErrorPanel from '../../shared/ui/status/ErrorPanel.svelte'
import LoaderOverlay from '../../shared/ui/status/LoaderOverlay.svelte'
import { BOOT_FAILURE_COPY_EN, type BootFailureCopy } from '../../shared/ui/status/boot-failure'
import { type FixtureLocale, say } from './locale-fixture'

const { show, locale = 'en' }: { show: StatusShow; locale?: FixtureLocale } = $props()
/** A word in the contract's locale, as a game's `t()` would give it. A fixture's props are fixed for its mount. */
const t = (text: string): string => say(locale, text)
const none = (): void => undefined
// About 1000 characters, as the framework audit used: longer than any screen can show at once.
const SENTENCE =
  "Couldn't load your progress. The save on this device could not be read, and the copy kept " +
  'online did not answer in time. You can try again now, or go on without it for this run. '
const LONG = t(SENTENCE.repeat(6).trim())
const BOOT_COPY = Object.fromEntries(
  Object.entries(BOOT_FAILURE_COPY_EN).map(([name, text]) => [name, t(text)]),
) as BootFailureCopy
</script>

{#if show === 'loader'}
  <LoaderOverlay label={t('Loading the game')} progress={0.4} slow slowLabel={t('This is taking a while.')} />
{:else}
  <ScreenFrame arrangement="stack" back={none} backLabel={t('Back')}>
    {#snippet body()}<p>{t('Choose a level')}</p>{/snippet}
  </ScreenFrame>
  {#if show === 'boot-failure'}
    <BootFailurePanel
      failure={{ _tag: 'HostError', code: 'QUOTA_EXCEEDED', retryable: false, operation: 'saves.get' }}
      hostKind="standalone"
      hostName={t('this page')}
      copy={BOOT_COPY}
      canExit={false}
      onRetry={none}
      onContinue={none}
      onExit={none}
    />
  {:else if show === 'model-invalid'}
    <!-- A damaged model whose hashed file name has no break opportunity. -->
    <BootFailurePanel
      failure={{
        _tag: 'ModelInvalid',
        file: '/assets/nightstand-with-a-long-hashed-name-DkFIQVVxQWERTYUIOPASDFGHJKLZXCVBNM0123456789.glb',
        reason: 'malformed: truncated',
      }}
      hostKind="ruken"
      hostName="Ruken"
      canExit
      onRetry={none}
      onExit={none}
    />
  {:else if show === 'final-long'}
    <ErrorPanel code="unsupported" message={LONG} actions={[]} final />
  {:else if show === 'error-three'}
    <ErrorPanel
      code="progress"
      message={t("Couldn't load your progress.")}
      actions={[
        { id: 'retry', label: t('Try again'), kind: 'primary', onSelect: none },
        { id: 'dismiss', label: t('Continue without loading'), kind: 'secondary', onSelect: none },
        { id: 'help', label: t('Get help'), kind: 'secondary', onSelect: none },
      ]}
    />
  {:else}
    <ErrorPanel
      code="progress"
      message={show === 'error-long' ? LONG : t("Couldn't load your progress.")}
      actions={[
        { id: 'retry', label: t('Try again'), kind: 'primary', onSelect: none },
        { id: 'dismiss', label: t('Continue without loading'), kind: 'secondary', onSelect: none },
      ]}
    />
  {/if}
{/if}
