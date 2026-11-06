import { afterEach, expect, test, vi } from 'vitest'
import { installFakeResizeObserver } from '#src/fixtures/resize-observer.ts'

let restore: (() => void) | undefined
afterEach(() => restore?.())

test('stands in for ResizeObserver and reports a width to every observer until it disconnects', () => {
  const fake = installFakeResizeObserver()
  restore = fake.restore
  const seen = vi.fn()
  const observer = new ResizeObserver((entries) => seen(entries[0]?.contentRect.width))
  observer.observe(document.createElement('div'))
  fake.resize(320)
  expect(seen).toHaveBeenCalledWith(320)
  observer.disconnect()
  fake.resize(400)
  expect(seen).toHaveBeenCalledOnce()
})

test('restore puts the previous ResizeObserver back', () => {
  const previous = globalThis.ResizeObserver
  installFakeResizeObserver().restore()
  expect(globalThis.ResizeObserver).toBe(previous)
})
