import { render, screen } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import TextView from './TextView.svelte'

// The read-only text of a file that does not open (plan ED2D.4c2b, decision 3).

const numbered = (n: number): string => Array.from({ length: n }, (_, at) => `line ${at + 1}`).join('\n')
const lines = (): HTMLElement[] => [...document.querySelectorAll<HTMLElement>('.line')]

describe('TextView', () => {
  it('draws every line of a short file with its number, read only', () => {
    render(TextView, { text: '{\n  "format": "af2d"\n}\n', marked: [] })
    expect(screen.getByText('Read only')).toBeInTheDocument()
    expect(lines().map((line) => line.textContent)).toEqual(['1{', '2  "format": "af2d"', '3}'])
    expect(document.querySelector('textarea, input, [contenteditable]')).toBeNull()
    expect(screen.queryByText(/Lines \d+ to/)).toBeNull()
  })

  it('marks the lines an error points at, and names them for a screen reader', () => {
    render(TextView, { text: 'a\nb\nc', marked: [2] })
    const marked = document.querySelectorAll('[data-marked]')
    expect(marked).toHaveLength(1)
    expect(marked[0]).toHaveTextContent('2b')
    expect(marked[0]).toHaveAttribute('aria-label', 'Line 2, where an error is: b')
  })

  it('a long file shows the window around the first error and says which lines these are', () => {
    render(TextView, { text: numbered(2000), marked: [1500, 1700] })
    expect(screen.getByText('Lines 1300 to 1699 of 2000')).toBeInTheDocument()
    expect(lines()).toHaveLength(400)
    expect(lines()[0]).toHaveTextContent('1300line 1300')
  })

  it('is a scroll region a keyboard can reach', () => {
    render(TextView, { text: 'a', marked: [] })
    const region = screen.getByRole('region', { name: 'The file’s text' })
    expect(region).toHaveAttribute('data-scroll-region')
    expect(region).toHaveAttribute('tabindex', '0')
  })

  it('says so when the file is empty', () => {
    render(TextView, { text: '', marked: [] })
    expect(screen.getByText('The file is empty.')).toBeInTheDocument()
    expect(screen.queryByRole('region')).toBeNull()
  })
})
