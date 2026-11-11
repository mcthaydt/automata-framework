import '@automata/framework/theme.css'
import { fakeHosting, mountFixture } from '@automata/framework/testing'
import CreditsPanel from '#src/features/credits/CreditsPanel.svelte'
import type { Credits } from '#src/shared/credits/credits.schema.ts'
import { type Locale, layoutContract, pseudo, say } from '#src/testing/layout-sweep.ts'

// The credits panel scrolls inside its own panel: forty names must not push Close off the screen or scroll the page.
const names = (count: number, locale: Locale) =>
  Array.from({ length: count }, (_, index) => ({
    name: say(locale, `Person ${index + 1}`),
    role: say(locale, 'Designer and illustrator'),
    url: 'https://example.test/person',
  }))

const COPY = {
  title: 'Credits',
  close: 'Close',
  opens: (name: string) => `Open ${name}’s page`,
  refused: 'That page could not be opened.',
}

const mount = (locale: Locale, count: number) => {
  const credits: Credits = {
    sections: [
      { title: say(locale, 'Game'), names: names(Math.ceil(count / 2), locale) },
      { title: say(locale, 'Music'), names: names(Math.floor(count / 2) || 1, locale) },
    ],
  }
  const hosting = fakeHosting({}).create({ gameId: 'g', wants: [], pauseBehavior: 'pause' })
  return mountFixture(CreditsPanel, {
    credits,
    copy: locale === 'en' ? COPY : pseudo(COPY),
    onClose: () => {},
    hosting,
  })
}

layoutContract('credits', (locale) => mount(locale, 4), ['[data-modal-close]'])
layoutContract('credits (forty names)', (locale) => mount(locale, 40), ['[data-modal-close]'])
