import axe from 'axe-core'

// The accessibility pass of the suite's real-browser tests (plan EDS.10, step 2): axe-core's rules over a subtree,
// reduced to a line per violation so a failure names the rule, the impact and the elements. Only `color-contrast` is
// off, and only because axe cannot judge text over a canvas (the stage and the plan are drawn, not styled); the
// tokens' contrast is the kit's own test. No other rule is disabled.

export async function axeViolations(root: Element): Promise<string[]> {
  const result = await axe.run(root, { rules: { 'color-contrast': { enabled: false } } })
  return result.violations.map(
    (violation) =>
      `${violation.id} (${violation.impact ?? 'unrated'}): ${violation.help}: ${violation.nodes
        .map((node) => node.target.join(' '))
        .join(', ')}`,
  )
}
