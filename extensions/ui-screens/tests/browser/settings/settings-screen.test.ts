import '@automata/framework/theme.css'
import { PSEUDO_LOCALE } from '@automata/content/locale'
import { mountFixture } from '@automata/framework/testing'
import { createRawSnippet } from 'svelte'
import SettingsScreen from '#src/features/settings/SettingsScreen.svelte'
import { type Locale, layoutContract, pseudo, say } from '#src/testing/layout-sweep.ts'

const nothing = (): void => {}
const COPY = {
  title: 'Settings',
  back: 'Back',
  tabs: 'Settings tabs',
  more: (count: number) => `+${count} more`,
}
/** A section in the language under test: a line and a button, as core's sections are. */
const section = (locale: Locale, line: string, button: string) => ({
  snippet: createRawSnippet(() => ({
    render: () =>
      `<div><p>${say(locale, line)}</p><button type="button" class="af-control">${say(locale, button)}</button></div>`,
  })),
})
const mount = (locale: Locale) =>
  mountFixture(SettingsScreen, {
    copy: locale === PSEUDO_LOCALE ? pseudo(COPY) : COPY,
    tabs: [
      {
        id: 'settings',
        label: locale === PSEUDO_LOCALE ? pseudo('Settings') : 'Settings',
        sections: [section(locale, 'Volume', 'Louder')],
      },
      {
        id: 'controls',
        label: locale === PSEUDO_LOCALE ? pseudo('Controls') : 'Controls',
        sections: [section(locale, 'Rebind keys', 'Rebind')],
      },
    ],
    onBack: nothing,
  })

layoutContract('settings', mount, ['settings-tab-settings', 'settings-tab-controls'])
