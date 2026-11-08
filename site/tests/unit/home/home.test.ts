import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, waitFor } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import Home from '#src/features/home/Home.svelte'
import {
  CREATE_COMMAND,
  DEMO_BAR,
  EXAMPLE_EXCERPT,
  EXAMPLE_PATH,
  TARGETS,
} from '#src/features/home/home-content.ts'
import { USAGE } from '../../../../packages/tools/src/shared/ship/cli-args'

// The tests run from the site's folder; the example lives at the repository's root.
const repo = resolve(process.cwd(), '..')

describe('Home', () => {
  it('makes one claim, with one lime primary per screen and the real first command', () => {
    const view = render(Home)
    expect(view.getByRole('heading', { level: 1 }).textContent).toBe(
      'Make browser games with your coding agent.',
    )
    // The hero's lime primary and the closing one are a screen apart; the demo's Play is the white secondary.
    const primaries = [...view.container.querySelectorAll('a.button, button.button')]
    expect(primaries.map((element) => element.textContent?.trim())).toEqual(['Make a game', 'Make a game'])
    expect(view.getByText(CREATE_COMMAND)).toBeTruthy()
    expect(CREATE_COMMAND).toMatch(/^npx @automata\/tools create-game /)
  })

  it('shows code that is in the example, line for line', () => {
    const source = readFileSync(resolve(repo, EXAMPLE_PATH), 'utf8')
    for (const line of EXAMPLE_EXCERPT.split('\n').filter((each) => each.trim() !== ''))
      expect(source, `"${line.trim()}" is not in ${EXAMPLE_PATH}`).toContain(line.trim())
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
    for (const gone of [/base-2d/, /git clone/, /Effect/, /remix/i, /planned/i, /Open source/i])
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
    for (const name of ['HomeHero', 'HomeDemo', 'HomeCode', 'HomeEditor', 'HomeTargets', 'HomeStart'])
      expect(files, name).toContain(`${name}.svelte`)
  })
})
