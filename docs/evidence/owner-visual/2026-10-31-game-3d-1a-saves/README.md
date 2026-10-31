# GAME-3D.1a part 1: base-3d's save on the menu and paused (#297)

Chromium (the `base-3d` Playwright project, Pixel 7 landscape) at 844×390 and 780×270, under the shared fake Ruken host. The game is the e2e build (`e2e:game`, the production build). Captured on 2026-10-31 from #297's branch, head `ffd2211b`. The menu and paused are the framework's default screens (`SaveSlots`, `SaveStatus`); base-3d only gives them its save.

| Image (each at `-844x390` and `-780x270`) | What it shows | What to check |
| --- | --- | --- |
| `menu-empty` | A new account: one empty slot, with New game | New game is focused and fully inside the frame |
| `menu-ready` | A slot one session wrote (New game, then pause): the slot's time, Continue and Delete… | No New game over a saved slot; Continue is focused; both actions sit inside the frame at 780×270 |
| `menu-newer` | The same slot saved with version 2, as a newer build would: "Saved by a newer version of the game" | Continue is not offered at all (the default list removes it rather than disabling it); only Delete…, which asks first |
| `menu-unreadable` | A slot whose stored value is not a save: "This save can't be opened" | Only Delete…, so the slot is never overwritten in one tap |
| `paused-no-grant` | A host that grants no saves, paused after New game: "Progress won't be kept", once | One status line; the four actions and the close button are not clipped |

## What to check in every image

- Touch targets are at least 44 px and primary actions 48 px. Measured on paused at both sizes: ✕ 44×44, Resume and Mute 230–234×48, Settings and Quit to title 230–234×44. The menu's actions use the same `ActionBar` buttons.
- Nothing is clipped.
- At 780×270, the slot list and its actions fit without scrolling.

The same measurement found one more button, 16×6 and partly outside the frame. It has no text, and it is not visible in any image. It is a framework element (not base-3d's), recorded here so the reviewer can check it.

The words are the default screens' English. GAME-3D.1a part 2 moves them to message keys.
