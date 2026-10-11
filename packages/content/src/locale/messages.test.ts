import { describe, expect, it } from 'vitest'
import { checkTranslation, collectMessages, messageKey, renderMessages, snakeKey } from './messages'

// Ported from FloorFifty tests/content/messages.test.ts (122a220): keys are content_<kind>_<id>_<field> in
// snake_case, written in the inlang message format.
describe('messageKey', () => {
  it('snake-cases the kind, the ID (nested folders included) and the field path', () => {
    expect(snakeKey('fastFall')).toBe('fast_fall')
    expect(snakeKey('snow-shrine')).toBe('snow_shrine')
    expect(messageKey('stage', 'snow-shrine', ['displayName'])).toBe('content_stage_snow_shrine_display_name')
    expect(messageKey('weapon', 'melee/sword', ['info', 'displayName'])).toBe(
      'content_weapon_melee_sword_info_display_name',
    )
    expect(messageKey('tutorial', undefined, ['steps', 0, 'prompt'])).toBe('content_tutorial_steps_0_prompt')
  })
})

describe('collectMessages', () => {
  it('keys every localized text and reports a key two texts share', () => {
    const result = collectMessages([
      { kind: 'character', id: 'ninja', texts: [{ path: ['displayName'], text: 'Ninja' }] },
      { kind: 'character', id: 'ninja-x', texts: [{ path: ['bio'], text: 'A' }] },
      { kind: 'character', id: 'ninja', texts: [{ path: ['x', 'bio'], text: 'B' }] },
    ])
    expect(result.messages).toEqual({
      content_character_ninja_display_name: 'Ninja',
      content_character_ninja_x_bio: 'A',
    })
    expect(result.collisions).toEqual([
      { index: 2, path: ['x', 'bio'], key: 'content_character_ninja_x_bio' },
    ])
  })
})

describe('renderMessages', () => {
  it('writes the inlang format with $schema first and keys sorted', () => {
    expect(renderMessages({ content_b: 'B', content_a: 'A' })).toBe(
      '{\n  "$schema": "https://inlang.com/schema/inlang-message-format",\n  "content_a": "A",\n  "content_b": "B"\n}\n',
    )
  })
})

describe('checkTranslation', () => {
  const source = { content_a: 'A', content_b: 'B' }

  it('accepts a translation with exactly the source keys', () => {
    expect(checkTranslation(source, { $schema: 'x', content_a: 'Á', content_b: 'Ḃ' })).toEqual([])
  })

  it('lists missing and extra keys, and non-text values', () => {
    expect(checkTranslation(source, { content_a: 1, content_c: 'C' })).toEqual([
      { path: ['content_a'], code: 'staleTranslation', message: 'content_a must be text' },
      { path: ['content_b'], code: 'staleTranslation', message: 'missing content_b' },
      { path: ['content_c'], code: 'staleTranslation', message: 'content_c is not a source key' },
    ])
    expect(checkTranslation(source, [])).toEqual([
      { path: [], code: 'staleTranslation', message: 'a translation is a JSON object of message keys' },
    ])
  })
})
