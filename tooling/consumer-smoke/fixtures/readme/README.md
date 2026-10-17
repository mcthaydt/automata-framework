# A README whose commands do not resolve (readme.test.ts)

```sh
git clone https://github.com/mcthaydt/automata-framework.git
cd automata-framework
corepack enable
pnpm install
pnpm no-such-script                       # not a root script
pnpm --filter @af-examples/missing dev    # no such package
pnpm --filter @af-examples/base-2d serve  # a real package without this script
node tooling/missing/src/run.ts           # no such file
make all                                  # not a command the check knows
```
