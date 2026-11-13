import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import facts from 'virtual:framework/facts'
import example from 'virtual:framework/home-example'
import { render, waitFor } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import Home from '#src/features/home/Home.svelte'
import {
  CHANGELOG_SECTION,
  CREATE_COMMAND,
  DEMO_BAR,
  HERO,
  HOME_EXAMPLES,
  numberWord,
  TARGETS,
} from '#src/features/home/home-content.ts'
import { APP_PRICES, NO_CREDITS } from '#src/shared/content/pricing.ts'
import { PICTURES } from '#src/shared/pictures.ts'
import { USAGE } from '../../../../packages/tools/src/shared/ship/cli-args'

// The tests run from the site's folder; the example lives at the repository's root.
const repo = resolve(process.cwd(), '..')

describe('Home', () => {
  it('makes one claim, with one lime primary per screen and the real first command', () => {
    const view = render(Home)
    expect(view.getByRole('heading', { level: 1 }).textContent).toBe(HERO.title)
    expect(HERO.title).toBe('Finish the game your agent started.')
    // One lime button on the page: the closing band is lime itself, so its button is dark, and the demo's Play is the
    // white secondary.
    const primaries = [...view.container.querySelectorAll('a.button, button.button')]
    expect(primaries.map((element) => element.textContent?.trim())).toEqual(['Make a game'])
    const closing = view.container.querySelector('.close .go')
    expect(closing?.textContent?.trim()).toBe('Make a game')
    expect(closing?.getAttribute('href')).toBe('/start')
    expect(view.getAllByText(CREATE_COMMAND).length).toBeGreaterThan(0)
    expect(CREATE_COMMAND).toMatch(/^npx @automata\/tools create-game /)
  })

  it("shows the example's whole code, not an excerpt, as a scroll region the keyboard can reach", () => {
    const source = readFileSync(resolve(repo, example.dir, example.file), 'utf8')
    // The file minus its header comment (the leading `//` lines, which are for the catalogue): every other byte is shown.
    const code = source.replace(/^(\/\/.*\n)+/, '')
    expect(code.startsWith('import { defineComponent, defineGame,')).toBe(true)
    const view = render(Home)
    const region = view.container.querySelector('.show .sample .code-scroll')
    expect(region?.textContent).toBe(code.trimEnd())
    expect(region?.getAttribute('tabindex')).toBe('0')
    expect(region?.getAttribute('role')).toBe('region')
    expect(region?.getAttribute('aria-label')).toBe("The example's code, whole")
  })

  it("shows the golden's hash in the Checks table, for every engine, and claims no result it did not measure", () => {
    const view = render(Home)
    const table = view.container.querySelector('table')!
    const rows = [...table.querySelectorAll('tbody tr')]
    expect(rows.map((row) => row.querySelector('th')?.textContent)).toEqual(
      facts.engines.map((engine) => engine.name),
    )
    for (const row of rows) expect(row.querySelector('td code')?.textContent).toBe(facts.golden.hash)
    const section = table.closest('.show')!
    expect(section.textContent).toContain(facts.golden.file)
    expect(section.textContent).toContain(`${facts.golden.ticks} ticks`)
    expect(section.textContent).not.toMatch(/same result/i)
  })

  it('names the four places a game goes, each with a command automata ship accepts', () => {
    expect(TARGETS.map((target) => target.title)).toEqual(['The web', 'itch.io', 'A desktop app', 'Ruken'])
    for (const { command } of TARGETS) {
      const [, , verb, , target] = command.split(' ')
      expect(USAGE).toContain(`automata ship ${verb}`)
      expect(['web', 'itch', 'ruken']).toContain(target)
    }
    expect(USAGE).toContain('--from tauri')
  })

  it('says nothing the framework no longer has or does not do', () => {
    const text = render(Home).container.textContent ?? ''
    // "Deterministic", "ECS" and "no-code" are words for the docs, not for a maker deciding (GTM research, section 11).
    for (const gone of [
      /base-2d/,
      /git clone/,
      /Effect/,
      /remix/i,
      /planned/i,
      /Open source/i,
      /determinis/i,
      /\bECS\b/,
      /no-code/i,
    ])
      expect(text).not.toMatch(gone)
  })

  it('the demo shows the poster with no overlay text', () => {
    const view = render(Home)
    const demo = view.getByTestId('demo-runner-container')
    expect(demo.querySelector('img.demo-poster')).toBeTruthy()
    expect(demo.textContent).not.toMatch(/Plays here|Play demo|nothing to install/)
    expect(demo.querySelector('.demo-status')).toBeNull()
  })

  it('the bar has the title, the tagline and one button "Play it", which is not a lime primary', () => {
    const view = render(Home)
    const bar = view.getByTestId('demo-runner-container').querySelector('.demo-bar')!
    expect(bar.textContent).toContain(DEMO_BAR.title)
    expect(bar.textContent).toContain(DEMO_BAR.tagline)
    const buttons = [...bar.querySelectorAll('button')]
    expect(buttons.map((button) => button.textContent?.trim())).toEqual(['Play it'])
    expect(buttons[0]!.hasAttribute('data-play')).toBe(true)
    expect(buttons[0]!.classList.contains('button')).toBe(false)
  })

  it('the code sample is highlighted', async () => {
    const view = render(Home)
    await waitFor(() => {
      const coloured = [...view.container.querySelectorAll('.code-block span')].find(
        (span) => span.textContent === 'const' && /color:/i.test(span.getAttribute('style') ?? ''),
      )
      expect(coloured).toBeTruthy()
    })
  })

  it('the code panel is labelled "What it draws"', () => {
    const view = render(Home)
    expect(view.getByText('What it draws')).toBeTruthy()
  })

  it('every Home section file is under 600 lines', () => {
    const folder = resolve(process.cwd(), 'src/features/home')
    for (const name of readdirSync(folder).filter((file) => /\.(svelte|ts|css)$/.test(file))) {
      const lines = readFileSync(resolve(folder, name), 'utf8').split('\n').length
      expect(lines, `${name} has ${lines} lines`).toBeLessThanOrEqual(600)
    }
  })

  it('has one component per section', () => {
    const files = readdirSync(resolve(process.cwd(), 'src/features/home'))
    for (const name of [
      'HomeHero',
      'HomeDemo',
      'HomeFacts',
      'HomeMadeWith',
      'HomeBuiltIn',
      'HomeCode',
      'HomeDeterminism',
      'HomeEditor',
      'HomeExamples',
      'HomeTargets',
      'HomePricing',
      'HomeChangelog',
      'HomeStart',
    ])
      expect(files, name).toContain(`${name}.svelte`)
  })

  it('puts the sections in the order the GTM research asks for: the pain, the proof, then the price', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/features/home/Home.svelte'), 'utf8')
    const order = [...source.matchAll(/^<(Home\w+) \/>$/gm)].map((found) => found[1])
    expect(order).toEqual([
      'HomeHero',
      'HomeFacts',
      'HomeMadeWith',
      'HomeBuiltIn',
      'HomeCode',
      'HomeDeterminism',
      'HomeEditor',
      'HomeTargets',
      'HomePricing',
      'HomeExamples',
      'HomeChangelog',
      'HomeStart',
    ])
  })

  it('lists what every game has built in, so the demo is already a game', () => {
    const view = render(Home)
    const list = view.getByRole('list', { name: 'Built into every game' })
    const names = [...list.querySelectorAll('h3')].map((heading) => heading.textContent)
    expect(names).toEqual(['Saves', 'Menus and settings', 'Controls', 'Sound', 'Every screen', 'Languages'])
  })

  it('says what the languages are: six out of the box, and one command to translate your own words', () => {
    const view = render(Home)
    const list = view.getByRole('list', { name: 'Built into every game' })
    const item = [...list.querySelectorAll('li')].find(
      (li) => li.querySelector('h3')?.textContent === 'Languages',
    )
    expect(item?.textContent).toContain(`${numberWord(facts.languages)} languages`)
    expect(facts.languages).toBeGreaterThan(1)
    expect(item?.textContent).toContain('automata words')
    // The command it names is one the framework answers to: its guide documents it.
    expect(readFileSync(resolve(repo, 'docs/guides/languages.md'), 'utf8')).toContain('automata words')
  })

  it('does not say Automata runs no AI without naming the one command that asks a model', () => {
    // `automata words` asks a Claude model, with the maker's own key; "no credits" stays true, "no AI at all" does not.
    const text = render(Home).container.textContent ?? ''
    expect(text).toContain('Automata sells no credits')
    expect(text).not.toMatch(/runs no AI of its own/)
    expect(text).toMatch(/automata words[^.]*your own key/)
  })

  it('says the price on Home from the same place /app reads it, with no credits', () => {
    const text = render(Home).container.textContent ?? ''
    expect(text).toContain(APP_PRICES.phone)
    expect(text).toContain(APP_PRICES.computer)
    expect(text).toContain(NO_CREDITS)
    expect(text).toMatch(/Every editor is free/)
  })

  it('shows the Made with Automata strip as a carousel that stops for a reader who asks for no motion', () => {
    const view = render(Home)
    const strip = view.container.querySelector('[aria-label="Made with Automata"]')
    expect(strip, 'the strip is missing').toBeTruthy()
    expect(strip!.querySelector('img[alt="SNEKPRTY"]')).toBeTruthy()
    const css = readFileSync(resolve(process.cwd(), 'src/features/home/HomeMadeWith.svelte'), 'utf8')
    expect(css).toMatch(/prefers-reduced-motion/)
    expect(css).toMatch(/animation-play-state:\s*paused/)
  })

  it('shows six examples that all exist, and counts them from the catalogue', () => {
    const view = render(Home)
    expect(HOME_EXAMPLES).toHaveLength(6)
    const links = [...view.container.querySelectorAll('a[href^="/examples/"]')]
    for (const id of HOME_EXAMPLES)
      expect(
        links.some((link) => link.getAttribute('href') === `/examples/${id}`),
        id,
      ).toBe(true)
  })

  it('takes a picture of each example it shows, and of no other', () => {
    const pictured = PICTURES.filter((picture) => picture.target === 'example').map((picture) => picture.name)
    expect(pictured).toEqual(HOME_EXAMPLES.map((id) => `example-${id}`))
  })

  it('says the changelog is what is landing, never that it shipped', () => {
    const view = render(Home)
    expect(view.getByText(CHANGELOG_SECTION.title)).toBeTruthy()
    expect(view.container.textContent).not.toMatch(/Recently shipped/)
  })
})
