# Hotspots and the play HUD

A hotspot is a place in a 3D level where the player can do something: read a note, open a drawer, sit down. The play HUD is
what tells them where to go and what they can do there. Both are data. This guide uses the prologue of The Last Light
(`games/the-last-light`), the reference game, and quotes its own files.

> **3D is in a private beta.** See [Make a 3D game](./3d.md). The two pieces here, `@automata/interact` and `@automata/hud`,
> are for adventure games: a person walks, a prompt appears near something they can use, and pressing the key does it.

## What a hotspot is

A hotspot is a point in the level with a name, a reach and an optional hide. It says *where* something can be used. It does
not say *what happens*: that is an action in the puzzle file, which points at the hotspot by its id.

Here is the nightstand, as the level file holds it:

```json
{ "def": "hotspot", "id": "nightstand", "x": -3.12, "z": -0.3, "y": 0.9, "reach": 1.4, "name": "hotspot.nightstand" }
```

| Field | Meaning |
|---|---|
| `id` | What an action points at. It never changes once an action uses it. |
| `x`, `z`, `y` | Where it is: on the floor, then how high. |
| `reach` | How close the player must stand, in metres. |
| `name` | A message key for what the player sees: "Nightstand". Never the words themselves, so the words can be translated. |
| `hide` | Whether it is a place to hide: using it takes the player out of the creature's sight. |

The level declares the kind once, with the fields a hotspot may have and their defaults:

```json
{ "id": "hotspot", "shape": "point", "fields": [{ "id": "reach", "type": "float", "default": 1.4 }, { "id": "name", "type": "text" }, { "id": "hide", "type": "bool", "default": false }] }
```

## Place one in Levels 3D

Open the level in Levels 3D. A hotspot is an entity of the kind `hotspot` the level declares, so the editor shows its `reach`,
`name` and `hide` as fields and lets you move the point. Moving it moves the prompt and nothing else. Save, and the running game
shows the new place.

A hotspot's *conditions* (it can be used only once the supply door is open) are not fields the editor can show yet. They stay
data in the puzzle file, and the editor gaps ledger lists it.

## What happens: an action

An action says where it happens (`at`, a hotspot id), the words it says (`say`, a line id), when it can be done (`when`) and
what it changes (`then`). The nightstand gives the hand lamp first, and the paraffin second:

```toml
[[actions]]
id = "nightstand.lamp"
at = "nightstand"
say = "nightstandLamp"

[[actions.when]]
fact = "nightstand"
is = 0

[[actions.then]]
set = "nightstand"
to = 1

[[actions.then]]
give = "handLamp"
```

The same hotspot has a second action, `nightstand.paraffin`, that works only once `nightstand` is `1`: the fact each action sets
is what orders them.

## The HUD file

`content/hud/play.toml` says which pieces show, where they sit and how wide they may be. There are five pieces:

| Piece | What it shows |
|---|---|
| `objective` | One line: what to do next |
| `prompt` | The key, the verb and the name of the hotspot in reach |
| `inventory` | What the player carries |
| `examine` | The words of a thing, in a box the player closes |
| `keypad` | A code pad |

```toml
[[pieces]]
kind = "objective"
anchor = "top-left"
width = 360

[[pieces]]
kind = "prompt"
anchor = "bottom"
width = 280
```

An anchor is a corner or an edge, and a width is the most the piece may take.

## The objective line

The objective is chosen by rows, read first to last: the first row whose conditions all hold wins. A row's `line` is a message
key, and its `target` is the hotspot the line points toward.

```toml
# The note read: the key is in the cabinet, and the code is in the note.
[[objective]]
line = "prologue.objective.key"
target = "cabinet"

[[objective.when]]
fact = "noteRead"
is = true
```

Put the most specific rows first and the general one last, as the prologue does: the last row ("Otherwise: the note") needs no
condition at all.

## What the UI editor will take over

Today the HUD file is edited by hand. The UI editor the Owner has asked for will open it, so the file is plain data with a
schema (`@automata/hud/content`) and a check names a row whose line has no words. A HUD the old game had that this file cannot
say yet (a minimap, a marker on the goal, a leader line from the prompt to its hotspot) is listed in the editor gaps ledger.

## Check it

`pnpm build` compiles the HUD file against its schema, so a misspelt field or an unknown piece is named with its file and line. The
game's unit tests play the whole prologue with a bot, so a hotspot moved out of reach, or an action that names a hotspot the
level lacks, fails there first.
