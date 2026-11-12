// Typed words written as they are typed, and the saved line (`@automata/editor/kit/typing`).

export { guardLeaving, type LeaveWindow } from '../shared/kit/storage/leave-guard'
export {
  browserDraftStorage,
  createTypingDrafts,
  type DraftStorage,
  pageTimers,
  TYPING_DELAY_MS,
  type TypingCommit,
  type TypingDrafts,
  type TypingDraftsDeps,
  type TypingField,
  type TypingFieldOptions,
  type TypingTimers,
} from '../shared/kit/storage/typing-drafts'
export { fieldPosition } from '../shared/kit/widgets/field-position'
export { type TypedSaveParams, typedSave } from '../shared/kit/widgets/typed-save'
export { setTypingDrafts, typingDrafts } from '../shared/kit/widgets/typing-context'
