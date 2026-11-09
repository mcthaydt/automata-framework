import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import { USAGE } from '../../../../packages/tools/src/shared/ship/cli-args'
import Home from '../../../src/features/home/Home.svelte'
import {
  CREATE_COMMAND,
  EXAMPLE_EXCERPT,
  EXAMPLE_PATH,
  TARGETS,
} from '../../../src/features/home/home-content'

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
    expect(CREATE_COMMAND).toMatch(/^npx @automataframework\/automata-tools create-game /)
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
})
