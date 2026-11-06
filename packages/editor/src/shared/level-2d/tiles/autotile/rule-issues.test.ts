import { describe, expect, it } from 'vitest'
import { makeGroup, makeRule } from '../../../../testing/level-2d/rules'
import { type RuleContext, type RuleIssue, ruleIssues } from './rule-issues'

const context: RuleContext = { values: new Set([1, 2, 3]), tileCount: 16 }
const codes = (issues: readonly RuleIssue[]): string[] => issues.map((issue) => `${issue.code}:${issue.rule}`)

describe('ruleIssues', () => {
  it('finds nothing wrong with sound rules', () => {
    const groups = [
      makeGroup('ground', [
        makeRule('fill', ['#'], { tiles: [1, 2] }),
        makeRule('top', ['?.?', '?#?', '???'], { tiles: [3], flipX: true }),
        makeRule('tuft', ['?.?', '?1?', '???'], { tiles: [4], chance: 0.25 }),
      ]),
    ]
    expect(ruleIssues(groups, context)).toEqual([])
  })

  describe('valueUnknown', () => {
    it('flags a pattern that names an IntGrid value the source layer does not define, is or not', () => {
      const groups = [
        makeGroup('g', [makeRule('is7', ['7']), makeRule('not8', ['h']), makeRule('fine', ['2'])]),
      ]
      const issues = ruleIssues(groups, context)
      expect(codes(issues)).toEqual(['valueUnknown:is7', 'valueUnknown:not8'])
      expect(issues[0]).toMatchObject({ severity: 'warning', group: 'g' })
      expect(issues[0]?.message).toMatch(/value 7/)
    })

    it('flags an outside value that is not defined, but not 0 or "same"', () => {
      const groups = [
        makeGroup('g', [
          makeRule('far', ['#'], { outside: 9 }),
          makeRule('zero', ['#'], { outside: 0 }),
          makeRule('same', ['#'], { outside: 'same' }),
          makeRule('known', ['#'], { outside: 3 }),
        ]),
      ]
      expect(codes(ruleIssues(groups, context))).toEqual(['valueUnknown:far'])
    })

    it('says a value once per rule, however many cells name it', () => {
      const groups = [makeGroup('g', [makeRule('twice', ['7??', '?#7', '???'])])]
      expect(codes(ruleIssues(groups, context))).toEqual(['valueUnknown:twice'])
    })
  })

  describe('neverFires', () => {
    it('flags a rule with chance 0 and a rule with no tiles', () => {
      const groups = [
        makeGroup('g', [makeRule('zero', ['#'], { chance: 0 }), makeRule('blank', ['#'], { tiles: [] })]),
      ]
      const issues = ruleIssues(groups, context)
      expect(codes(issues)).toEqual(['neverFires:zero', 'neverFires:blank'])
      expect(issues[0]?.severity).toBe('warning')
      expect(issues[0]?.message).toMatch(/chance/)
      expect(issues[1]?.message).toMatch(/no tile/)
    })
  })

  describe('tileOutOfRange', () => {
    it('is an error for a tile index beyond the tileset, and names the tile', () => {
      const groups = [makeGroup('g', [makeRule('big', ['#'], { tiles: [3, 16, 99] })])]
      const issues = ruleIssues(groups, context)
      expect(codes(issues)).toEqual(['tileOutOfRange:big'])
      expect(issues[0]).toMatchObject({ severity: 'error' })
      expect(issues[0]?.message).toMatch(/16, 99/)
    })

    it('is not checked when the tileset’s size is not known', () => {
      const groups = [makeGroup('g', [makeRule('big', ['#'], { tiles: [9999] })])]
      expect(ruleIssues(groups, { values: context.values, tileCount: undefined })).toEqual([])
    })

    it('accepts the last tile of the tileset', () => {
      expect(ruleIssues([makeGroup('g', [makeRule('last', ['#'], { tiles: [15] })])], context)).toEqual([])
    })
  })

  describe('shadowed', () => {
    const shadow = (...rules: ReturnType<typeof makeRule>[]) => ruleIssues([makeGroup('g', rules)], context)

    it('flags a later rule that an earlier break-on-match rule always pre-empts', () => {
      const issues = shadow(
        makeRule('fill', ['#'], { breakOnMatch: true }),
        makeRule('edge', ['?.?', '?#?', '???']),
      )
      expect(codes(issues)).toEqual(['shadowed:edge'])
      expect(issues[0]).toMatchObject({ severity: 'info', group: 'g' })
      expect(issues[0]?.message).toMatch(/"fill"/)
    })

    it('does not, in the other order: the specific rule goes first', () => {
      expect(
        shadow(makeRule('edge', ['?.?', '?#?', '???'], { breakOnMatch: true }), makeRule('fill', ['#'])),
      ).toEqual([])
    })

    it('needs the earlier rule to break on match, to be sure to fire, to be active and to be flip-free', () => {
      const later = makeRule('edge', ['?.?', '?#?', '???'])
      expect(shadow(makeRule('fill', ['#']), later)).toEqual([])
      expect(shadow(makeRule('fill', ['#'], { breakOnMatch: true, chance: 0.5 }), later)).toEqual([])
      expect(shadow(makeRule('fill', ['#'], { breakOnMatch: true, active: false }), later)).toEqual([])
      // (It has its own problem, but it does not pre-empt anything.)
      expect(codes(shadow(makeRule('fill', ['#'], { breakOnMatch: true, tiles: [] }), later))).toEqual([
        'neverFires:fill',
      ])
      expect(shadow(makeRule('fill', ['#'], { breakOnMatch: true, flipX: true }), later)).toEqual([])
    })

    it('needs the same outside value', () => {
      expect(
        shadow(
          makeRule('fill', ['#'], { breakOnMatch: true, outside: 0 }),
          makeRule('edge', ['?.?', '?#?', '???'], { outside: 1 }),
        ),
      ).toEqual([])
    })

    it('needs the earlier pattern to be at least as general at every cell it reads', () => {
      const wide = makeRule('wide', ['?.?', '?#?', '???'], { breakOnMatch: true })
      // `1` is narrower than "filled" at the centre, so the later "filled" rule can match where `1` does not.
      expect(shadow(makeRule('one', ['1'], { breakOnMatch: true }), makeRule('filled', ['#']))).toEqual([])
      // The reverse: "filled" covers `1`, `a` (not 1) covers `2`, empty covers only empty.
      expect(
        codes(shadow(makeRule('filled', ['#'], { breakOnMatch: true }), makeRule('one', ['1']))),
      ).toEqual(['shadowed:one'])
      expect(codes(shadow(makeRule('not1', ['a'], { breakOnMatch: true }), makeRule('two', ['2'])))).toEqual([
        'shadowed:two',
      ])
      expect(
        codes(shadow(makeRule('not1', ['a'], { breakOnMatch: true }), makeRule('empty', ['.']))),
      ).toEqual(['shadowed:empty'])
      expect(shadow(makeRule('empty', ['.'], { breakOnMatch: true }), makeRule('two', ['2']))).toEqual([])
      // A rule that reads a cell the later one does not care about covers less, not more.
      expect(shadow(wide, makeRule('fill', ['#']))).toEqual([])
    })

    it('also covers the later rule’s mirrored variants: all of them must be pre-empted', () => {
      const top = makeRule('top', ['?.?', '?#?', '???'], { breakOnMatch: true })
      // flipY reads "below is empty" too, which `top` does not pre-empt.
      expect(shadow(top, makeRule('both', ['?.?', '?#?', '???'], { flipY: true }))).toEqual([])
      // `top` only needs "above empty" and "centre filled"; a symmetric later pattern is covered in every mirroring.
      expect(
        codes(
          shadow(
            makeRule('sym', ['?.?', '?#?', '?.?'], { breakOnMatch: true }),
            makeRule('sym2', ['?.?', '?#?', '?.?'], { flipX: true }),
          ),
        ),
      ).toEqual(['shadowed:sym2'])
    })

    it('reports a rule once, against the first rule that pre-empts it, across groups', () => {
      const groups = [
        makeGroup('a', [makeRule('first', ['#'], { breakOnMatch: true })]),
        makeGroup('b', [makeRule('second', ['#'], { breakOnMatch: true }), makeRule('late', ['1'])]),
      ]
      const issues = ruleIssues(groups, context)
      expect(codes(issues)).toEqual(['shadowed:second', 'shadowed:late'])
      expect(issues.map((issue) => issue.group)).toEqual(['b', 'b'])
      expect(issues[1]?.message).toMatch(/"first"/)
    })

    it('does not report a later rule that is itself off, or an earlier rule in an inactive group', () => {
      const later = makeRule('edge', ['?.?', '?#?', '???'])
      expect(shadow(makeRule('fill', ['#'], { breakOnMatch: true }), { ...later, active: false })).toEqual([])
      const groups = [
        makeGroup('off', [makeRule('fill', ['#'], { breakOnMatch: true })], false),
        makeGroup('on', [later]),
      ]
      expect(ruleIssues(groups, context)).toEqual([])
    })
  })

  it('leaves out rules that are off', () => {
    const groups = [
      makeGroup('g', [makeRule('big', ['9'], { tiles: [99], active: false })]),
      makeGroup('h', [makeRule('big2', ['9'], { tiles: [99] })], false),
    ]
    expect(ruleIssues(groups, context)).toEqual([])
  })

  it('lists issues in group and rule order', () => {
    const groups = [
      makeGroup('a', [makeRule('x', ['7'], { tiles: [99] }), makeRule('y', ['#'], { chance: 0 })]),
      makeGroup('b', [makeRule('z', ['8'])]),
    ]
    expect(codes(ruleIssues(groups, context))).toEqual([
      'valueUnknown:x',
      'tileOutOfRange:x',
      'neverFires:y',
      'valueUnknown:z',
    ])
  })
})
