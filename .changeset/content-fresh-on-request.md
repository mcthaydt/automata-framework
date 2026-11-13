---
'@automata/content': patch
---
The dev server no longer serves `virtual:automata/content` older than the content on disk. A page that asked for the module after a save but before the file watcher reported it (seconds later on a busy machine) used to get the previous build and keep it until a reload, so pressing Play right after a Tuner edit played the old content. Every request for the module now compares the sources with what the last build read and builds again when they differ; the outcome is published once, as for a watched save.
