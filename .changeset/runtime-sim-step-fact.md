---
'@mcthaydt/automata-runtime': patch
---

The presentation bus publishes a new fact, `sim.step`, with `sim.events`: the step's tick (`StepResult.tick`) and the same events, for a listener that needs to know when an event happened. `sim.events` is unchanged.
