import { describe, expect, it } from 'vitest'
import { GET } from '#src/routes/api/ping/+server'

describe('/api/ping', () => {
  it('tells the try-it editor this is not an editor server, so it keeps levels in the browser', async () => {
    const body = (await GET().json()) as { automata?: string }
    expect(body.automata).toBeDefined()
    expect(body.automata).not.toBe('editor')
  })
})
