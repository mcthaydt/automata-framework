import { expect, test } from 'vitest'
import { isAllowedHostOrigin } from './allowlist'

const PROD_GAME = 'https://g-abcdefghij.rukengames.com'
const LOCAL_GAMES = ['http://localhost:4400', 'http://g-abcdefghij.localhost:8787', 'http://127.0.0.1:4401']

// Cases copied from P01 §4 rules and the §10 item 3 allowlist table.
test.each([
  ['https://ruken.com', PROD_GAME, true],
  ['https://test.ruken.com', PROD_GAME, true],
  ['https://admin.private.ruken.com', PROD_GAME, true],
  ['https://pr-12.preview.ruken.com', PROD_GAME, true],
  ['https://ruken.com:443', PROD_GAME, true],
  ['https://evilruken.com', PROD_GAME, false],
  ['https://ruken.com.example.net', PROD_GAME, false],
  ['http://test.ruken.com', PROD_GAME, false],
  ['https://ruken.com:8443', PROD_GAME, false],
  ['tauri://localhost', PROD_GAME, true],
  ['http://tauri.localhost', PROD_GAME, true],
  ['https://tauri.localhost', PROD_GAME, true],
  ['http://localhost:5173', PROD_GAME, false],
  ['http://127.0.0.1:4300', PROD_GAME, false],
  ...LOCAL_GAMES.flatMap((g) => [
    ['http://localhost:5173', g, true] as const,
    ['http://127.0.0.1:4300', g, true] as const,
  ]),
  ['http://localhost:5173', 'http://abc.rkg.localhost', true],
  ['http://localhost:5173', 'https://g-x.rukengames-dev.com', false],
  ['https://localhost:5173', 'http://localhost:4400', false], // the local rule requires http:
  ['not a url', PROD_GAME, false],
] as const)('host %s with game %s -> %s', (host, game, allowed) => {
  expect(isAllowedHostOrigin(host, game)).toBe(allowed)
})
