import { render } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import DemoRunner from '../src/lib/components/DemoRunner.svelte'
import ExamplesPage from '../src/routes/examples/+page.svelte'
import { examplesData } from './helpers/page-data'

describe('Examples Gallery', () => {
  it('renders category filter and active demo code', () => {
    const { getByText, getAllByText } = render(ExamplesPage, { props: { data: examplesData('renderer-2d') } })
    expect(getByText(/All Examples/i)).toBeTruthy()
    expect(getAllByText(/Renderer: 2D PixiJS/i).length).toBeGreaterThan(0)
  })

  it('DemoRunner renders container with controls and iframe element', () => {
    const { getByTestId, getByLabelText } = render(DemoRunner, {
      props: {
        src: '/demos/render-pixi/renderer-2d/index.html',
        title: 'Renderer: 2D PixiJS',
      },
    })
    expect(getByTestId('demo-runner-container')).toBeTruthy()
    expect(getByLabelText(/Restart demo/i)).toBeTruthy()
    expect(getByLabelText(/Toggle fullscreen/i)).toBeTruthy()
  })
})
