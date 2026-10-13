import { describe, expect, it, vi } from 'vitest'
import { readBlob } from './fetch-progress.js'

describe('readBlob', () => {
  it('reports every chunk with the running total and announced content-length', async () => {
    const chunk1 = new Uint8Array([1, 2, 3])
    const chunk2 = new Uint8Array([4, 5])
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(chunk1)
        controller.enqueue(chunk2)
        controller.close()
      },
    })
    const response = new Response(stream, {
      headers: { 'content-length': '5' },
    })

    const onReceived = vi.fn()
    const blob = await readBlob(response, 'application/octet-stream', onReceived)

    expect(onReceived).toHaveBeenCalledTimes(2)
    expect(onReceived).toHaveBeenNthCalledWith(1, { received: 3, total: 5 })
    expect(onReceived).toHaveBeenNthCalledWith(2, { received: 5, total: 5 })
    expect(blob.size).toBe(5)
    expect(blob.type).toBe('application/octet-stream')
  })

  it('produces a blob whose bytes equal the chunks joined', async () => {
    const chunk1 = new Uint8Array([10, 20])
    const chunk2 = new Uint8Array([30, 40, 50])
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(chunk1)
        controller.enqueue(chunk2)
        controller.close()
      },
    })
    const response = new Response(stream)
    const blob = await readBlob(response, 'image/png')

    const buffer = new Uint8Array(await blob.arrayBuffer())
    expect(Array.from(buffer)).toEqual([10, 20, 30, 40, 50])
  })

  it('handles responses with no announced content-length (total undefined)', async () => {
    const chunk = new Uint8Array([1, 2])
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(chunk)
        controller.close()
      },
    })
    const response = new Response(stream)
    const onReceived = vi.fn()
    const blob = await readBlob(response, 'text/plain', onReceived)

    expect(onReceived).toHaveBeenCalledWith({ received: 2, total: undefined })
    expect(blob.size).toBe(2)
    expect(blob.type).toBe('text/plain')
  })

  it('reads a response with null body whole and reports once with its size', async () => {
    const response = new Response(null, { status: 200 })
    const onReceived = vi.fn()
    const blob = await readBlob(response, 'application/json', onReceived)

    expect(onReceived).toHaveBeenCalledWith({ received: 0, total: undefined })
    expect(blob.size).toBe(0)
    expect(blob.type).toBe('application/json')
  })

  it('rejects with the stream error when reading the stream fails', async () => {
    const boom = new Error('stream exploded')
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.error(boom)
      },
    })
    const response = new Response(stream)
    await expect(readBlob(response, 'text/plain')).rejects.toThrow('stream exploded')
  })
})
