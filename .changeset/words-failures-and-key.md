---
'@automata/tools': patch
---

`automata words` tells a key the translator turned down, a limit and an outage apart from a model's refusal, and stops at the first of them instead of asking for every word (what it translated is kept). A 429 is asked again a few times, waiting longer each time. The key is `AUTOMATA_ANTHROPIC_KEY` when set, else `ANTHROPIC_API_KEY`, and is never printed.
