---
'@mcthaydt/automata-ui': patch
---

Adds `SaveStatus` and `SaveSlots` for a game's saves (M5.2). `SaveStatus` says the host's save state in words (checking, syncing, saved, offline, retrying, conflict, recovered, or "no grant") in a polite live region that is not focusable, and renders nothing where there is no status (standalone). `SaveSlots` is the slot list: rows are chosen, and the chosen row's actions (Continue, New game, Delete… behind a confirming dialog whose safe button has focus) sit in an action bar; the rows scroll in their own list and a label and a time wrap to two lines. Both take the caller's words and times, and read no store. Also exports the types `SaveStatusState`, `SaveStatusCopy`, `SaveSlotView`, `SaveSlotsView`, `SaveSlotsCopy` and `SaveSlotActivity`, and the helpers `SAVE_STATUS_TONES`, `defaultSlot` and `slotActionsOf`.
