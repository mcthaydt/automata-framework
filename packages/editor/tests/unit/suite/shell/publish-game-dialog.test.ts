// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import PublishGameDialog from '#src/features/suite/shell/PublishGameDialog.svelte'
import type { GamePublish, PublishResult } from '#src/shared/kit/storage/publish-client.ts'

// Publish in three plain steps, and one lime button in the dialog at a time: the one for the step the person is on.

function mount(results: readonly PublishResult[]) {
  const queue = [...results]
  const publish: GamePublish = {
    publish: async () => queue.shift() ?? { ok: false, problem: 'No more results.', detail: '' },
    download: async () => {},
  }
  render(PublishGameDialog, { open: true, publish })
  return screen.getByRole('dialog', { name: 'Put your game online' })
}

const limeButtons = (dialog: HTMLElement): string[] =>
  within(dialog)
    .getAllByRole('button')
    .filter((button) => button.getAttribute('data-kind') === 'primary')
    .map((button) => button.textContent?.trim() ?? '')

describe('Publish', () => {
  it('is titled "Put your game online", says what Publish does, and lists three steps', () => {
    const dialog = mount([])
    expect(
      within(dialog).getByText(
        'Publish builds your game and checks it is ready for the web. You get one zip file to upload to itch.io or any website host.',
      ),
    ).toBeInTheDocument()
    const steps = within(dialog).getAllByRole('listitem')
    expect(steps).toHaveLength(3)
    expect(steps[0]).toHaveTextContent('Build your game')
    expect(steps[1]).toHaveTextContent('Download the zip')
    expect(steps[2]).toHaveTextContent('Upload it')
  })

  it('marks the step the person is on, and moves it on as the game builds and is ready', async () => {
    const dialog = mount([{ ok: true, name: 'game.zip' }])
    const current = () => within(dialog).getByRole('listitem', { current: 'step' })
    expect(current()).toHaveTextContent('Build your game')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Build my game' }))
    await waitFor(() => expect(current()).toHaveTextContent('Download the zip'))
  })

  it('has "Build my game" as its one lime button to begin with', () => {
    expect(limeButtons(mount([]))).toEqual(['Build my game'])
  })

  it('has "Download the zip" as its one lime button once the game is built, and not before', async () => {
    const dialog = mount([{ ok: true, name: 'game.zip' }])
    await userEvent.click(within(dialog).getByRole('button', { name: 'Build my game' }))
    await within(dialog).findByText('Your game is ready to upload.')
    expect(limeButtons(dialog)).toEqual(['Download the zip'])
  })

  it('has "Try again" as its one lime button when the build failed', async () => {
    const dialog = mount([{ ok: false, problem: 'Your game did not build.', detail: '' }])
    await userEvent.click(within(dialog).getByRole('button', { name: 'Build my game' }))
    await within(dialog).findByRole('alert')
    expect(limeButtons(dialog)).toEqual(['Try again'])
  })
})
