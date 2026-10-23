// Run with: node --test docs/design/editor-3d/gallery.test.mjs
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildGallery } from './gallery.mjs'

test('the gallery has every screen once, in the order of the page', () => {
  const html = buildGallery()
  assert.match(html, /^<title>3D Level Editor Mockups<\/title>/)
  const ids = [...html.matchAll(/<figure id="([a-z]+)"/g)].map((m) => m[1])
  assert.deepEqual(ids, [
    'concept',
    'foundations',
    'split',
    'draw',
    'walk',
    'materials',
    'world',
    'portrait',
    'gestures',
    'checks',
  ])
  for (const id of ids) assert.match(html, new RegExp(`<a href="#${id}">`))
  assert.match(html, /<figure id="portrait" class="tall">/)
})

test('the gallery sizes each stage from its screen and stays well under the artifact limit', () => {
  const html = buildGallery()
  assert.match(html, /id="stage-portrait" data-w="834" data-h="1194"/)
  assert.match(html, /id="stage-split" data-w="1194" data-h="834"/)
  assert.doesNotMatch(html, /undefined|NaN/)
  assert.ok(html.length < 4 * 1024 * 1024)
})
