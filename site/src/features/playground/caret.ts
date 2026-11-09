// Where a tap on the static code lands in the source, so the editor opens with the caret there. The line
// numbers are CSS counters, so the static code's text is the source and a DOM range's text length is the offset.

/** The source offset of a DOM position inside `root`, or null when the position is outside it. */
export function offsetIn(root: Node, node: Node, offset: number): number | null {
  if (!root.contains(node)) return null
  const range = document.createRange()
  range.setStart(root, 0)
  range.setEnd(node, offset)
  return range.toString().length
}

interface CaretDocument {
  caretPositionFromPoint?(x: number, y: number): { offsetNode: Node; offset: number } | null
  caretRangeFromPoint?(x: number, y: number): Range | null
}

/** The source offset under a viewport point, or null when the browser cannot tell or the point is outside `root`. */
export function offsetAtPoint(root: HTMLElement, x: number, y: number): number | null {
  const doc = document as unknown as CaretDocument
  if (doc.caretPositionFromPoint) {
    const position = doc.caretPositionFromPoint(x, y)
    return position ? offsetIn(root, position.offsetNode, position.offset) : null
  }
  const range = doc.caretRangeFromPoint?.(x, y)
  return range ? offsetIn(root, range.startContainer, range.startOffset) : null
}
