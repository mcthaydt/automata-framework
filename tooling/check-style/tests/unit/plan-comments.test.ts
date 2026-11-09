import { describe, expect, test } from 'vitest'
import { planCommentFindings } from '#src/plan-comments.ts'

// A comment should say why, not which plan asked for the code. The rule reads every comment in a .ts, .svelte or .css
// file, and knows the ways a plan is cited: a milestone (`M4`, `M4.7`, `M4-D9`), a task (`task 6.4`), a plan code
// (`DX.2d`, `WEB.PLAY.1`, `FR.3`) and a section sign.
const MESSAGE = 'A comment should say why, not which plan asked for it. Explain the reason in plain words.'
const finding = (file: string, line: number) => ({ file, rule: 'plan-comment', message: MESSAGE, line })

describe('citations in a .ts comment', () => {
  const check = (code: string) => planCommentFindings('/p/a.ts', code)

  test.each([
    ['// (M4-D9) the reason\nexport const a = 1\n'],
    ['// M5-D6: why\nexport const a = 1\n'],
    ['// the playground (WEB.PLAY.1) needs it\nexport const a = 1\n'],
    ['// FR.3 says so\nexport const a = 1\n'],
    ['/** EDS.1d: why */\nexport const a = 1\n'],
    ['// PRODUCT.7 asked for it\nexport const a = 1\n'],
    ['// task 6.4 cut this\nexport const a = 1\n'],
    ['// Task 6.4 cut this\nexport const a = 1\n'],
    ['// the old entry (M1.6 spec §3.3)\nexport const a = 1\n'],
    ['// a pill over the stage (spec 11.4)\nexport const a = 1\n'],
    ['// the editor loads late (spec F2)\nexport const a = 1\n'],
    ['// the editor loads late (spec F-4)\nexport const a = 1\n'],
    ['// as plan 12.3 says\nexport const a = 1\n'],
  ])('%j is flagged', (code) => {
    expect(check(code)).toEqual([finding('/p/a.ts', 1)])
  })

  test.each([
    '// Tasks are queued in the order they arrive\nexport const a = 1\n',
    '// Wait 6.4 seconds for the task to finish\nexport const a = 1\n',
    '// HTTP/2 and UTF-8 both work here\nexport const a = 1\n',
    '// Uses a 3.4 GHz clock in the benchmark\nexport const a = 1\n',
    '// The M4-style layout is two columns\nexport const a = 1\n',
    '// The spec is the file the user wrote, so it is read as it is\nexport const a = 1\n',
    '// A plan for 3 days of food, spec by spec\nexport const a = 1\n',
  ])('%j passes', (code) => {
    expect(check(code)).toEqual([])
  })
})

describe('citations in a .svelte file', () => {
  const check = (code: string) => planCommentFindings('/p/A.svelte', code)

  test('a script comment, an HTML comment and a style comment are all read, with their lines', () => {
    const code = [
      '<script lang="ts">', // 1
      '  // (M4 spec §4.9) the reason', // 2
      '  const a = 1', // 3
      '</script>', // 4
      '', // 5
      '<!-- M4-D9: why -->', // 6
      '<p>{a}</p>', // 7
      '', // 8
      '<style>', // 9
      '  /* task 6.4 cut this */', // 10
      '  p { color: red; }', // 11
      '</style>', // 12
    ].join('\n')
    expect(check(code)).toEqual([
      finding('/p/A.svelte', 2),
      finding('/p/A.svelte', 6),
      finding('/p/A.svelte', 10),
    ])
  })

  test('a URL in a script string, and plain words in comments, pass', () => {
    const code = [
      '<script lang="ts">',
      "  const url = 'https://example.com/#M5.2' // the site",
      '</script>',
      '<!-- A button the player taps -->',
      '<style>',
      '  /* Keeps the button 44 px tall */',
      '</style>',
    ].join('\n')
    expect(check(code)).toEqual([])
  })
})

describe('citations in a .css file', () => {
  const check = (code: string) => planCommentFindings('/p/theme.css', code)

  test('a block comment that cites a plan is flagged on its own line', () => {
    expect(
      check('a { color: red; }\n/* One marker (M1.6 spec §3.3)\n   sizes it. */\nb { color: blue; }\n'),
    ).toEqual([finding('/p/theme.css', 2)])
  })

  test('a comment that says why passes, and so does a value that looks like a code', () => {
    expect(check('/* A double tap must not zoom the page. */\na { content: "M5.2"; }\n')).toEqual([])
  })
})
