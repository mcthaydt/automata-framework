export function isEditing(event: KeyboardEvent): boolean {
  return event.target instanceof Element && !!event.target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), dialog[open]')
}
