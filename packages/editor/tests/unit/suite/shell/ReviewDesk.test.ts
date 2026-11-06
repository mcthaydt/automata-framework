// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import type { ReviewChangeSet } from '#src/features/suite/core/review-model.ts'
import { lineDiff } from '#src/features/suite/core/text-diff.ts'
import ReviewDesk from '#src/features/suite/shell/ReviewDesk.svelte'

// The `review-desk` frame: the open change sets with each file's diff, the checks
// and measures, the gates with their links and the tokens. It records nothing.
const REVIEW: ReviewChangeSet = {
  title: 'Faster',
  branch: 'edit/faster',
  base: 'main',
  files: [
    {
      path: 'content/tuning.toml',
      created: false,
      before: 'speed = 6\n',
      after: 'speed = 8\n',
      hunks: lineDiff('speed = 6\n', 'speed = 8\n'),
    },
  ],
  checks: [
    {
      check: 'fair',
      status: 'fail',
      findings: [{ path: 'content/tuning.toml', line: 1, severity: 'error', message: 'too fast' }],
      before: [{ id: 'gap', label: 'Gap', value: 2.2, ok: true }],
      after: [{ id: 'gap', label: 'Gap', value: 0.4, ok: false }],
    },
  ],
  gates: { reopened: [{ id: 'g-feel', name: 'Feel review', decision: 'approved', url: 'https://x/g-feel' }] },
  tokens: { used: 1200, cap: 50000 },
}

describe('ReviewDesk', () => {
  it('no open change set says so', () => {
    render(ReviewDesk, { reviews: [] })
    expect(screen.getByText('No change set is open.')).toBeInTheDocument()
  })

  it('shows the diff, the failing check with its finding and measures, and the tokens', () => {
    render(ReviewDesk, { reviews: [REVIEW] })
    const desk = screen.getByRole('region', { name: 'Faster' })
    expect(within(desk).getByText('edit/faster')).toBeInTheDocument()
    expect(within(desk).getByText('- speed = 6')).toBeInTheDocument()
    expect(within(desk).getByText('+ speed = 8')).toBeInTheDocument()
    expect(within(desk).getByText('fair: fail')).toBeInTheDocument()
    expect(within(desk).getByText('content/tuning.toml:1 too fast')).toBeInTheDocument()
    expect(within(desk).getByText('Gap: 2.2 → 0.4')).toBeInTheDocument()
    expect(within(desk).getByText('1,200 of 50,000 tokens')).toBeInTheDocument()
  })

  it('an approved gate is still listed as reopened, with its link', () => {
    render(ReviewDesk, { reviews: [REVIEW] })
    expect(screen.getByText('Feel review: approved before this change; reopened')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Feel review record' })).toHaveAttribute(
      'href',
      'https://x/g-feel',
    )
  })

  it('an open gate says it has no decision yet', () => {
    render(ReviewDesk, {
      reviews: [{ ...REVIEW, gates: { reopened: [{ id: 'g-speed', name: 'Speed', decision: 'open' }] } }],
    })
    expect(screen.getByText('Speed: open, no decision yet')).toBeInTheDocument()
  })

  it('gates not readable say why, and list the gate as unknown', () => {
    render(ReviewDesk, {
      reviews: [
        {
          ...REVIEW,
          gates: {
            reopened: [{ id: 'g-feel', name: 'g-feel', decision: 'unknown' }],
            unreadable: 'no records',
          },
        },
      ],
    })
    expect(screen.getByText('Gates not readable: no records')).toBeInTheDocument()
    expect(screen.getByText('g-feel: state unknown')).toBeInTheDocument()
  })

  it('has no button that records a decision', () => {
    render(ReviewDesk, { reviews: [REVIEW] })
    expect(screen.queryAllByRole('button')).toEqual([])
  })
})
