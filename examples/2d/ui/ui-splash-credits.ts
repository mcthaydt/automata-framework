// ui-splash-credits: A studio splash, then a title with Credits
//
// Shows: `splashStep` from `@automataframework/ui-screens` is an opening step: the studio's logo, held for a moment and ended by
//   any press, before the first screen. The title has a Credits button beside Play; it opens `CreditsPanel` over a credits
//   file, and a name's link is opened by the host (Ruken asks the player first), a refusal said under the list. Credits
//   are data, checked by `creditsSchema`.
// Controls: tap or click; Escape closes Credits
// Packages: @automataframework/framework, @automataframework/ui-screens
// Difficulty: ★★★☆
// Tier: core
import { defaultContent, defineGame, type ScreenContext } from '@automataframework/framework'
import { creditsSchema, showCredits } from '@automataframework/ui-screens/credits'
import { splashStep } from '@automataframework/ui-screens/splash'

// The studio's mark, drawn for this repository (resources/logo/PROVENANCE.md).
const logo = new URL('../resources/logo/studio.svg', import.meta.url).href

// Credits are data. The schema refuses a link that is not https, and a name's role is a word `automata words` translates.
const credits = creditsSchema.parse({
  sections: [
    {
      title: 'Game',
      names: [
        { name: 'Ada Example', role: 'Design', url: 'https://example.test/ada' },
        { name: 'Bo Example', role: 'Code' },
      ],
    },
    { title: 'Music', names: [{ name: 'Cy Example', role: 'Composer' }] },
  ],
})

/**
 * The title: Play and Credits, in plain DOM on the framework's own control styles. Credits opens the panel over it and gives
 * focus back when it closes.
 */
const title = {
  id: 'title',
  enter(context: ScreenContext) {
    const { locale, hosting, flow } = context.services
    const doc = context.layer.ownerDocument
    const root = doc.createElement('div')
    root.dataset.testid = 'title-screen'
    root.style.cssText =
      'position:fixed;inset:0;display:grid;place-content:center;gap:16px;justify-items:center'
    const heading = doc.createElement('h1')
    heading.textContent = 'Moss Studio'
    const button = (id: string, label: string, kind: 'primary' | 'secondary', onPress: () => void) => {
      const element = doc.createElement('button')
      element.type = 'button'
      element.className = 'af-control'
      element.dataset.kind = kind
      element.dataset.testid = id
      element.textContent = label
      element.addEventListener('click', onPress)
      return element
    }
    let panel: { close(): void } | undefined
    const play = button('play', 'Play', 'primary', () => void flow.dispatch('play'))
    const open = button('credits', 'Credits', 'secondary', () => {
      if (panel !== undefined) return
      panel = showCredits({
        target: context.layer,
        credits,
        hosting,
        locale: locale.current,
        // Closing gives focus back to the button that opened it.
        onClose: () => {
          panel = undefined
          open.focus()
        },
      })
    })
    root.append(heading, play, open)
    context.layer.append(root)
    play.focus()
    context.screen.add(() => {
      panel?.close()
      root.remove()
    })
  },
}

/** Where Play goes: nothing to play here, so a line that says so. */
const play = {
  id: 'play',
  enter(context: ScreenContext) {
    const note = context.layer.ownerDocument.createElement('p')
    note.dataset.testid = 'play-screen'
    note.textContent = 'This example is only the splash and the credits.'
    context.layer.append(note)
    context.screen.add(() => note.remove())
  },
}

export default defineGame({
  id: 'ui-splash-credits',
  size: { width: 320, height: 180 },
  sim: { plugins: [] },
  // Credits links go through the host, so the game asks for `links` (the web and desktop targets always have it).
  hosting: { wants: ['links'] },
  opening: [splashStep({ logo: { src: logo, alt: 'Studio' } })],
  // Custom screens bring their own flow; the default one names title, play and paused, and the first two are here.
  content: defaultContent(),
  screens: [title, play],
})
