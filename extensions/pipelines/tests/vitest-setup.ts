// The bins run from source, and the core packages under them are TypeScript with parameter properties, which type
// stripping alone refuses; the tests start the bins with the flag the bins' own shebang carries. Child processes
// inherit this environment.
process.env.NODE_OPTIONS = '--experimental-transform-types --disable-warning=ExperimentalWarning'
