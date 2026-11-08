// The action that makes a text field write while it is typed in. It shows the value it is given (never while the
// person is typing in the field: the value a commit hands back is half a second old, and putting it back would eat the
// letters typed since), and passes its typing to a `TypingDrafts` registry, which commits after a pause, on leaving and
// on Ctrl/Cmd+Enter.
import type { ActionReturn } from 'svelte/action'
import type { TypingDrafts, TypingField } from '../storage/typing-drafts.ts'

type Node = HTMLInputElement | HTMLTextAreaElement

export interface TypedSaveParams {
  readonly drafts: TypingDrafts
  /** What the field shows when it is not being typed in. */
  readonly value: string
  /**
   * Writes the text. Called after a pause, on leaving and on Ctrl/Cmd+Enter; never twice for the same text. `leaving`
   * says the person has left the field. Returning false says the text was refused, so leaving tries it again.
   */
  commit(value: string, leaving: boolean, input: Node): void | boolean
  /** Names the field inside its editor, for the draft a closed page leaves behind. */
  readonly draftKey?: string | undefined
  /** False for a text that is not a value yet; it waits instead of being committed while typing. */
  valid?(value: string): boolean
  /** The field names something other files point at: it commits on leaving only. */
  readonly leaveOnly?: boolean | undefined
}

export function typedSave(node: Node, initial: TypedSaveParams): ActionReturn<TypedSaveParams> {
  let params = initial
  const field: TypingField = params.drafts.field((value, leaving) => params.commit(value, leaving, node), {
    key: params.draftKey,
    current: () => params.value,
    valid: (value) => params.valid?.(value) ?? true,
    leaveOnly: params.leaveOnly,
  })
  const focused = () => node.ownerDocument.activeElement === node
  node.value = params.value

  const onInput = () => field.typed(node.value)
  const onFocus = () => field.entered()
  const onBlur = () => field.left(node.value)
  const onKeydown = (event: Event) => {
    const key = event as KeyboardEvent
    if (key.key === 'Enter' && (key.ctrlKey || key.metaKey) && node instanceof HTMLTextAreaElement)
      node.blur()
  }
  node.addEventListener('input', onInput)
  node.addEventListener('focus', onFocus)
  node.addEventListener('blur', onBlur)
  node.addEventListener('keydown', onKeydown)

  return {
    update(next) {
      params = next
      if (!focused() && node.value !== next.value) node.value = next.value
    },
    destroy() {
      node.removeEventListener('input', onInput)
      node.removeEventListener('focus', onFocus)
      node.removeEventListener('blur', onBlur)
      node.removeEventListener('keydown', onKeydown)
      field.dispose()
    },
  }
}
