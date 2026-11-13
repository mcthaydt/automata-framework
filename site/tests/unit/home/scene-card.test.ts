import { render } from '@testing-library/svelte'
import { expect, it, vi } from 'vitest'
import HomeExamples from '#src/features/home/HomeExamples.svelte'

// Home's strip finds an id in the 3D catalogue too, so the day a 3D example joins it (F4) its card links to its own page.
vi.mock('#src/features/home/home-content.ts', async (original) => ({
  ...(await original<object>()),
  HOME_EXAMPLES: ['shapes-rects', 'scene-lamp'],
}))
vi.mock('virtual:framework/scenes', () => ({
  default: [
    {
      id: 'scene-lamp',
      title: 'a fixture room',
      shows: 'A room in 3D. Press Play.',
      controls: 'none',
    },
  ],
}))

it("shows a 3D example's card beside a 2D one, linking to /examples/<id>", () => {
  const view = render(HomeExamples)
  const hrefs = [...view.container.querySelectorAll('a.card')].map((a) => a.getAttribute('href'))
  expect(hrefs).toEqual(['/examples/shapes-rects', '/examples/scene-lamp'])
})
