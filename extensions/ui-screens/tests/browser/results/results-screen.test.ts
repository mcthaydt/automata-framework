import '@automata/framework/theme.css'
import { PSEUDO_LOCALE } from '@automata/content/locale'
import { mountFixture } from '@automata/framework/testing'
import ResultsScreen from '#src/features/results/ResultsScreen.svelte'
import { type Locale, layoutContract, pseudo, say } from '#src/testing/layout-sweep.ts'

// The results screen's layout contract: a long list of rows scrolls inside its region and the actions never leave the screen.
const nothing = (): void => {}
const COPY = { rows: 'Results', empty: 'Nothing to show', more: (count: number) => `+${count} more` }
const names = [
  'Wren',
  'Ash',
  'Moss',
  'Fern',
  'Birch',
  'Sedge',
  'Rowan',
  'Alder',
  'Hazel',
  'Linden',
  'Thorn',
  'Ivy',
]

const mount = (locale: Locale, rows = names.length) =>
  mountFixture(ResultsScreen, {
    title: say(locale, 'Race over'),
    rows: names.slice(0, rows).map((name, i) => ({
      id: `p${i}`,
      label: say(locale, name),
      value: say(locale, `${38 + i} s`),
      ...(i === 0 ? { detail: say(locale, 'new best') } : {}),
    })),
    highlight: 'p1',
    actions: [
      { id: 'again', label: say(locale, 'Play again'), primary: true },
      { id: 'title', label: say(locale, 'Back to title'), shortLabel: say(locale, 'Title') },
    ],
    copy: locale === PSEUDO_LOCALE ? pseudo(COPY) : COPY,
    onAction: nothing,
  })

layoutContract('results (12 rows)', (locale) => mount(locale), ['again', 'title'])
layoutContract('results (3 rows)', (locale) => mount(locale, 3), ['again', 'title'])
