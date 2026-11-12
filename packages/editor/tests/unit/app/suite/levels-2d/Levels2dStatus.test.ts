// @vitest-environment jsdom
import { render, screen } from '@testing-library/svelte'
import { writable } from 'svelte/store'
import { describe, expect, it } from 'vitest'
import Levels2dStatus from '#src/app/suite/levels-2d/Levels2dStatus.svelte'
import type { Levels2dSession } from '#src/app/suite/levels-2d/levels-2d-session.ts'

// The status line says which level is open in words, never by the file's path: where the game keeps it is not what a
// person calls it.
const session = (path: string, others: string[] = []) =>
  ({ path, others, refused: writable(undefined), shared: writable(undefined) }) as unknown as Levels2dSession

describe('the Levels status line', () => {
  it('names the open level in words, not by its path', () => {
    render(Levels2dStatus, { session: session('content/levels/start.af2d.json') })
    expect(screen.getByText('Start')).toBeInTheDocument()
    expect(screen.queryByText(/content\/levels/)).toBeNull()
  })

  it('says how many more levels the group holds', () => {
    render(Levels2dStatus, {
      session: session('content/levels/start.af2d.json', ['content/levels/hall.af2d.json']),
    })
    expect(screen.getByText('1 more in this group')).toBeInTheDocument()
  })
})
