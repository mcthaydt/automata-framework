import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fireEvent, render, within } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import IndexPage from '#src/features/examples/ExamplesIndex.svelte'
import { load as indexLoad } from '#src/routes/examples/+page.server.ts'
import { load as exampleLoad } from '#src/routes/examples/[id]/+page.server.ts'
import ExamplePage from '#src/routes/examples/[id]/+page.svelte'
import { exampleIndex, getScene, getScenes, moduleTitle } from '#src/shared/framework/example-catalog.ts'

// The site shows no 3D example while the kits are private, so the page is proved on fixtures: the catalog is given the
// fixture folder's one public example. The reader is Node's (it parses with oxc) and is proved on the same folder in
// tests/unit/framework/scene-examples.test.ts, so what it returns is written out here, with the file read as it is.
vi.mock('virtual:framework/scenes', () => {
  const path = 'scene/scene-lamp.ts'
  return {
    default: [
      {
        id: 'scene-lamp',
        module: 'scene',
        name: 'lamp',
        title: 'a fixture scene example that imports only public names',
        shows:
          "the site's 3D example page on a fixture. A coloured field and one line of text stand in for the set's room.",
        controls: 'Tap or press any key; Escape leaves the frame.',
        packages: ['@automata/framework'],
        difficulty: 1,
        tier: 'core',
        path,
        source: readFileSync(join(import.meta.dirname, '../../fixtures/scene-examples', path), 'utf8'),
        codeLines: 9,
        frameUrl: '/scenes/scene/lamp/index.html',
      },
    ],
  }
})

type PageData = Parameters<typeof ExamplePage>[1] extends never ? never : { data: never }
const open = async () => {
  const data = await exampleLoad({ params: { id: 'scene-lamp' } } as never)
  return render(ExamplePage, { props: { data } as PageData })
}

describe('the 3D example in the catalog', () => {
  it('is a group of its own, last, called what a person would call it', () => {
    expect(getScenes().map((scene) => scene.id)).toEqual(['scene-lamp'])
    expect(getScene('scene-lamp')?.frameUrl).toBe('/scenes/scene/lamp/index.html')
    const groups = exampleIndex()
    expect(groups.at(-1)?.module).toBe('scene')
    expect(moduleTitle('scene')).toBe('One small world, in 3D')
    expect(groups.at(-1)?.examples.map((example) => example.id)).toEqual(['scene-lamp'])
    // The index carries no source.
    expect(JSON.stringify(groups)).not.toContain("from '@automata/framework'")
  })
})

describe('the examples index', () => {
  it('lists the 3D example under its own heading, with a line saying how it differs, linking to its page', async () => {
    const view = render(IndexPage, { props: { data: await indexLoad() } })
    const heading = view.getByRole('heading', { name: 'One small world, in 3D' })
    const group = heading.closest('section') as HTMLElement
    expect(within(group).getByText(/press Play/i)).toBeTruthy()
    expect(group.querySelector('a[href="/examples/scene-lamp"]')).toBeTruthy()
  })
})

describe('the 3D example page', () => {
  it('says what it shows above the frame, and loads no frame until Play is pressed', async () => {
    const view = await open()
    // The same words are in the code's header comment, so look in the page's facts.
    const shows = within(view.container.querySelector('.spec-list') as HTMLElement).getByText(
      /the site's 3D example page on a fixture/i,
    )
    const play = view.getByRole('button', { name: 'Play' })
    expect(shows.compareDocumentPosition(play) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(view.container.querySelector('iframe')).toBeNull()
    expect(view.getAllByRole('button', { name: 'Play' })).toHaveLength(1)
  })

  // Phone first: only the words are above the frame, so Play is as high as they allow; the rest is under it.
  it('keeps only what it shows above the frame, and puts the difficulty and the packages under it', async () => {
    const view = await open()
    const facts = within(view.container.querySelector('.spec-list') as HTMLElement)
    expect(facts.getByText('Shows')).toBeTruthy()
    for (const label of ['Controls', 'Difficulty', 'Packages']) expect(facts.queryByText(label)).toBeNull()
    const under = within(view.container.querySelector('.scene-frame .facts') as HTMLElement)
    expect(under.getByText('@automata/framework')).toBeTruthy()
    expect(under.getByLabelText('Difficulty 1 of 4')).toBeTruthy()
  })

  it('loads the frame on Play, says what to press under it, and shows the code read-only', async () => {
    const view = await open()
    await fireEvent.click(view.getByRole('button', { name: 'Play' }))
    const frame = view.container.querySelector('iframe') as HTMLIFrameElement
    expect(frame.getAttribute('src')).toBe('/scenes/scene/lamp/index.html')
    expect(frame.title).toContain('a fixture scene example that imports only public names')
    expect(view.getByText('Tap or press any key; Escape leaves the frame.')).toBeTruthy()
    const code = view.container.querySelector('pre.static-code') as HTMLElement
    expect(code.textContent).toContain("import { defineGame } from '@automata/framework'")
    expect(view.container.querySelector('.cm-editor, textarea')).toBeNull()
  })

  it('moves focus into the frame when it has loaded, and out to Stop on Escape', async () => {
    const view = await open()
    await fireEvent.click(view.getByRole('button', { name: 'Play' }))
    const frame = view.container.querySelector('iframe') as HTMLIFrameElement
    const focused = vi.spyOn(frame.contentWindow as Window, 'focus').mockImplementation(() => {})
    await fireEvent.load(frame)
    expect(focused).toHaveBeenCalled()
    ;(frame.contentWindow as Window).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(document.activeElement).toBe(view.getByRole('button', { name: 'Stop' }))
  })

  // The page is prerendered, so Play is on screen before the script that answers it: the page's first-press script
  // keeps a press made until then (shared/html/hydration.ts), and the page starts when it mounts, as Home's demo does.
  it('keeps a press on Play made before the page was hydrated, and starts from it', async () => {
    document.documentElement.dataset.playPressed = ''
    const view = await open()
    expect(view.container.querySelector('iframe')).not.toBeNull()
    expect(document.documentElement.dataset.playPressed).toBeUndefined()
    expect(document.documentElement.dataset.playMounted).toBeDefined()
    expect(view.getByRole('button', { name: 'Stop' })).toBeTruthy()
    delete document.documentElement.dataset.playMounted
  })

  it('marks Play so the first-press script can keep an early press', async () => {
    const view = await open()
    expect(view.getByRole('button', { name: 'Play' }).hasAttribute('data-play')).toBe(true)
    delete document.documentElement.dataset.playMounted
  })

  it('drops the frame on Stop and offers Play again, focused', async () => {
    const view = await open()
    await fireEvent.click(view.getByRole('button', { name: 'Play' }))
    await fireEvent.click(view.getByRole('button', { name: 'Stop' }))
    expect(view.container.querySelector('iframe')).toBeNull()
    expect(document.activeElement).toBe(view.getByRole('button', { name: 'Play' }))
  })
})
