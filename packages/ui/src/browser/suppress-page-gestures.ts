/**
 * Turns off the browser's document gestures over the game.
 *
 * A right-click menu, a long-press menu or an image dragged off the page
 * reminds a player they are on a web page, which breaks the illusion the
 * screen is drawn. Text selection is off in CSS (`theme.css`); these two are
 * events, so they are cancelled here.
 *
 * Text fields are the exception. A name or code field keeps its menu, so
 * text can be pasted from a message.
 */

/** Whether an event target is somewhere a player types. */
function isEditable(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && target.closest("input, textarea, [contenteditable='true']") !== null
}

export function suppressPageGestures(doc: Document): () => void {
  const onContextMenu = (event: Event): void => {
    if (!isEditable(event.target)) event.preventDefault()
  }
  const onDragStart = (event: Event): void => {
    if (!isEditable(event.target)) event.preventDefault()
  }
  doc.addEventListener('contextmenu', onContextMenu)
  doc.addEventListener('dragstart', onDragStart)
  return () => {
    doc.removeEventListener('contextmenu', onContextMenu)
    doc.removeEventListener('dragstart', onDragStart)
  }
}
