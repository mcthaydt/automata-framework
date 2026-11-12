import '@automata/framework/theme.css'
import { mountFixture } from '@automata/framework/testing'
import SplashScreen from '#src/features/splash/SplashScreen.svelte'
import { type Locale, layoutContract, say } from '#src/testing/layout-sweep.ts'

// The splash has no control: the contract is that the logo and the skip line stay inside the visible region, with no
// document scroll, even in the longest words and with the keyboard up.
const LOGO = {
  src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="%23446"/></svg>',
  alt: 'Moss Studio',
}

layoutContract(
  'splash',
  (locale: Locale) =>
    mountFixture(SplashScreen, {
      logo: { ...LOGO, alt: say(locale, LOGO.alt) },
      copy: { skip: say(locale, 'Press any key or tap to skip') },
      onDone: () => {},
    }),
  [],
)
