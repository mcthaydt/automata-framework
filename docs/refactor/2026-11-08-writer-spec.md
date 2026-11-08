# Writer: who says what

Status: spec, 2026-11-08. Shared parts: [`2026-11-08-content-editors-spec.md`](2026-11-08-content-editors-spec.md)
(package, session, look, words). Plan: [`2026-11-08-writer-plan.md`](2026-11-08-writer-plan.md).

## 1. Why

A game's words are its people: what the shopkeeper says when you walk in, what you can answer, what changes because of
it. Writer is where a person writes them as a script and sees every way a conversation can go. It writes the narrative
extension's lines and conversations. The content-in-play work draws them in the game (a dialogue box and captions), and
its journey edits a line in Writer and sees the box show it, so this spec must say where the words are saved.

## 2. What the content can say today

`@automata/narrative`:

- **Lines** (`content/lines/<scene>.toml`, `lines.schema.ts`): each line has an `id` (`<scene>.<name>`), a `kind`
  (`dialogue`, `bark`, `caption`, `examine`, `item`, `note`, `objective`, `caught`, `file`), an optional `speaker`, and
  `text`, **a locale key, not the words**: the sim holds the key, and the words exist only on screen. Lines may also
  name canon facts, a story beat, hints and motifs.
- **Conversations** (`content/dialogue/<scene>.toml`, `dialogue.schema.ts`): each graph has an `id`, a `speaker`, a
  `start` node and named nodes. A node says some lines in order (`say`, line ids), then offers choices or goes on to
  `next`. A node whose `when` conditions fail is passed over. A choice is a line the player says, how far it moves the
  player's standing with the speaker (`stance`), facts it sets, and the node it leads to. Conditions are the puzzle's
  (`Cond`: a fact is a value or within a range, the player has an item, not, any of).
- **The canon** (`content/canon`): the people (names and how they speak) and the stance's range. Writer reads it for
  speakers and the range; it does not edit it (content editors spec, section 2).
- **Dialogue lint** (`@automata/narrative/tools`): every node leads somewhere that exists and can be reached, there is
  exactly one way out and every node reaches it, and the game's voice rules (who never shouts, how wide a line may be).
  It runs in Node through `automata-pipe narrative run <scene> --json`.

## 3. What a person does in Writer

1. **Pick a scene** (the panel lists the scenes that have lines or conversations), then **Lines** or a
   **Conversation**.
2. **Write lines** as a script: "Shopkeeper: Welcome in. Mind the step." Each line shows who says it, the words, and
   its kind in words ("Said in a conversation", "Called out", "On screen in a cutscene", "Read when you look at
   something"). **Add a line** asks who says it and what they say; the id is made from the scene and the first words
   (`shop.welcome_in`), and the person never types a key.
3. **Write a conversation** as a branching script, read top to bottom from the start:
   - each part ("node") shows its lines as the script, then either "Then: Goodbye" (its `next`) or the player's
     choices, each as "You say: I'm just looking. Goes to: Browsing.";
   - **Add a choice** writes the player's line and picks or makes the part it goes to;
   - a choice's **Standing** ("Warmer +1", "Colder −1", within the canon's range) and **Remembers** (facts it sets, as
     "Remembers: asked about the key = yes");
   - a part's **Only if** conditions in words ("Only if the player has the key", "Only if trust is at least 2");
   - a small computed map of the parts beside the script (boxes and arrows, no saved layout, tap to go there).
4. **See what is wrong** in words, beside the part it is about: "Nothing leads to Browsing, so no one can reach it.",
   "Goodbye is never reached from here, so this conversation never ends.", "There is no line shop.thanks yet."
5. **Read it through.** **Play it** walks the conversation in the editor: the lines appear in turn, the choices are
   buttons, and the facts it sets are kept for the walk only. It reads the file; it never runs the game.
6. **Rename and remove** a part, a choice or a line. Removing a line that a conversation or a cutscene still says asks
   first and names where: "The conversation Shopkeeper and the cutscene Arrival still say this line."

## 4. Where the words are saved

**In the line, in the game's source language, as a translatable text.** Each line record gains `words`, marked
`localized()` (`@automata/content/schema`), so the content compiler puts it in the game's message catalog
(`content/generated/messages/<source>.json`) and translators get it with every other text
(`content/messages/<lang>.json`). `text` stays the key the sim holds, and Writer sets it to the line's id when it makes
a line:

```toml
[[lines]]
id = "shop.welcome_in"
kind = "dialogue"
speaker = "shopkeeper"
text = "shop.welcome_in"
words = "Welcome in. Mind the step."
```

`@automata/narrative` exports `wordsOf(lines, translation?)`: the map from each line's `text` to its words (the
translation's for that line's message key when given, else the source words). The game passes it as
`narrativeExtension({ words })`, which the dialogue box and captions read (content-in-play spec, "Words"). A line with
no `words` is not an error to the compiler; Writer shows it as "No words yet" and the box reports it once, as that spec
says.

Why here: AF's source-language text lives in the TOML it belongs to (`localized()` fields), and translations are the
only JSON a person edits by hand. A separate words file would split a line from its words and leave translators a
second catalog. The cost: the compiler keys a message by its path, so moving a line inside its file renames its key and
marks translations stale. Writer never reorders a lines file; it shows lines in its own order and adds new ones at the
end.

`lineSchema` is also exported from `@automata/narrative/sim`, and a `localized()` field turns its text into a marker
object when parsed. So `words` is `localized()` only in the `lines` content kind's schema (`narrative.content.ts`
extends `lineSchema` for it); the sim's `lineSchema` takes `words` as plain optional text. The sim never reads `words`.

## 5. Choices from the file

A speaker field offers the canon's people, then the speakers already in the scene, then "Someone new…". A line field
offers the scene's lines by their words. A part field offers the conversation's parts, then "A new part…". A fact field
offers the facts the scene's puzzle and conversations name. An item field offers the puzzle's items. A value that names
nothing shows the schema's problem in words on that field.

## 6. Layout

Panel: scenes, and under the chosen scene "Lines" and each conversation by its speaker ("Shopkeeper"). Canvas: the
script. At 820 px and wider the conversation's map sits beside the script; narrower, **Map** is a toggle above it.
Inspector (when the suite shows one): the chosen line's or choice's fields. Touch targets 44 px, primary actions 48 px.
The words fields are multi-line and grow with the text; the page keeps focus and the caret through the on-screen
keyboard.

## 7. Checks

- Unit: lines to script rows and back; ids from words (lower case, `_`, unique in the scene, at most 40 characters);
  conversation to parts in reading order (start first, then by first reach); the map's computed boxes; the problems in
  words for every dialogue lint structure finding; `wordsOf` with and without a translation.
- Narrative: `words` in the lines content kind is `localized()`; the compiler puts it in the catalog; the sim loads a
  file with `words` unchanged; `wordsOf` exported.
- DOM: add a line (no key typed), edit words, add a choice to a new part, set standing and remembers, rename a part
  (every `next` and choice that names it follows), remove a line that is still said (asks first), Play it.
- Chromium layout at 390×844 and 820×1180, the on-screen keyboard at phone size (the words field stays in view).

## 8. Open choices

1. **Words in the line** (section 4) or a separate words file per scene. Recommended: in the line.
2. **Storylets, beats and hints** stay out of Writer for now (content editors spec, section 2). Recommended: keep them
   out until a game made in the editor needs them.
