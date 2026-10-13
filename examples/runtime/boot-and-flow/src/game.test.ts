import { runGame } from '@mcthaydt/automata-runtime'
import { fakeFetch, manualFrames } from '@mcthaydt/automata-runtime/testing'
import { describe, expect, it } from 'vitest'
import { demoGame } from './game.ts'

describe('demoGame (§8 boot and flow demo)', () => {
  it('standalone boot reaches ready on title; Play -> play with rising tick; Pause -> paused with paused tick; Resume -> play', async () => {
    const root = document.createElement('div')
    document.body.appendChild(root)

    const frames = manualFrames()
    const fetchMock = fakeFetch({
      '/assets/title.txt': { chunks: [new TextEncoder().encode('title content')] },
      '/assets/play.txt': { chunks: [new TextEncoder().encode('play content')] },
    })

    const game = demoGame(undefined, {
      root,
      frames,
      fetch: fetchMock.fetch,
    })

    const handle = runGame(game)

    // Wait until boot reaches ready (frame 1 advance)
    while (!frames.pending) {
      await new Promise((r) => setTimeout(r, 5))
    }
    frames.advance(16.67)

    // Wait for ready state
    while (document.documentElement.getAttribute('data-state') !== 'ready') {
      await new Promise((r) => setTimeout(r, 5))
    }

    expect(document.documentElement.getAttribute('data-state')).toBe('ready')
    expect(root.querySelector('[data-testid="title-screen"]')).not.toBeNull()

    // 1. Play -> play screen
    const playBtn = root.querySelector('[data-testid="play-btn"]') as HTMLButtonElement
    expect(playBtn).not.toBeNull()
    playBtn.click()

    while (!root.querySelector('[data-testid="play-screen"]')) {
      await new Promise((r) => setTimeout(r, 5))
    }

    const tickSpan = root.querySelector('[data-testid="tick"]') as HTMLSpanElement
    expect(tickSpan).not.toBeNull()
    expect(tickSpan.textContent).toBe('0')

    // Advance frames: tick counter rises
    frames.advance(16.67)
    frames.advance(16.67)
    expect(Number(tickSpan.textContent)).toBeGreaterThan(0)
    const tickBeforePause = Number(tickSpan.textContent)

    // 2. Pause -> paused screen
    const pauseBtn = root.querySelector('[data-testid="pause-btn"]') as HTMLButtonElement
    expect(pauseBtn).not.toBeNull()
    pauseBtn.click()

    while (!root.querySelector('[data-testid="paused-screen"]')) {
      await new Promise((r) => setTimeout(r, 5))
    }

    // Advancing frames does NOT advance sim tick because Time holds menu pause
    frames.advance(16.67)
    frames.advance(16.67)

    // 3. Resume -> play screen
    const resumeBtn = root.querySelector('[data-testid="resume-btn"]') as HTMLButtonElement
    expect(resumeBtn).not.toBeNull()
    resumeBtn.click()

    while (!root.querySelector('[data-testid="play-screen"]')) {
      await new Promise((r) => setTimeout(r, 5))
    }

    const resumedTick = root.querySelector('[data-testid="tick"]') as HTMLSpanElement
    expect(Number(resumedTick.textContent)).toBe(tickBeforePause)

    // Advancing frames resumes stepping
    frames.advance(16.67)
    expect(Number(resumedTick.textContent)).toBeGreaterThan(tickBeforePause)

    await handle.shutdown()
    root.remove()
  })

  it.each([
    ['init', 'start'],
    ['saves', 'progress'],
    ['content', 'damaged'],
    ['download', 'download'],
    ['renderer', 'unsupported'],
  ] as const)("failMode='%s' shows panel with data-code='%s'", async (mode, expectedCode) => {
    const root = document.createElement('div')
    document.body.appendChild(root)

    const frames = manualFrames()
    const fetchMock = fakeFetch({
      '/assets/title.txt': { chunks: [new TextEncoder().encode('title content')] },
      '/assets/play.txt': { chunks: [new TextEncoder().encode('play content')] },
    })

    const game = demoGame(mode, {
      root,
      frames,
      fetch: fetchMock.fetch,
    })

    const handle = runGame(game)

    while (!frames.pending) {
      await new Promise((r) => setTimeout(r, 5))
    }
    frames.advance(16.67)

    while (document.documentElement.getAttribute('data-state') !== 'failed') {
      await new Promise((r) => setTimeout(r, 5))
    }

    expect(document.documentElement.getAttribute('data-state')).toBe('failed')
    const alert = root.querySelector('[role="alert"]')
    expect(alert).not.toBeNull()
    expect(alert?.getAttribute('data-code')).toBe(expectedCode)

    await handle.shutdown()
    root.remove()
  })
})
