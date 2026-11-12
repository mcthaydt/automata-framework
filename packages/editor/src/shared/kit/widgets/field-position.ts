// Where a field sits on the screen, as a name a draft can be kept under. Many fields share a label (Writer's six lines
// are all "What it says"), so a label cannot say which one the person typed in; the place in the editor's own markup
// can. The name starts at the region the field is in (panel, canvas, inspector…), so what sits above the region, or
// whether the panel is a column or a sheet, does not change it.

/** The element's place among the elements next to it, with its tag: `article[2]`. */
function step(element: Element): string {
  const parent = element.parentElement
  const at = parent === null ? 0 : [...parent.children].indexOf(element)
  return `${element.localName}[${String(at)}]`
}

export function fieldPosition(node: Element): string {
  const steps: string[] = []
  let at: Element | null = node
  while (at !== null && at !== at.ownerDocument.body) {
    const region = at.getAttribute('data-region')
    if (region !== null) return [region, ...steps.reverse()].join('/')
    steps.push(step(at))
    at = at.parentElement
  }
  return ['page', ...steps.reverse()].join('/')
}
