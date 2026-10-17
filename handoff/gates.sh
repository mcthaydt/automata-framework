#!/bin/bash
# usage: gates.sh <worktree> <name> <serverport> <previewport> <gates...>
W=$1; N=$2; export AF_E2E_SERVER_PORT=$3 AF_E2E_PREVIEW_PORT=$4; shift 4
L=/tmp/claude-0/-home-user/b319e7ac-e5eb-5240-8858-357a923ba393/scratchpad
export PATH=/opt/nvm/versions/node/v24.21.0/bin:$PATH PLAYWRIGHT_BROWSERS_PATH=/home/user/pw CI=1 TURBO_FORCE=true
cd $W || exit 1
pnpm install --frozen-lockfile > $L/logs/$N-install.txt 2>&1
pnpm format > /dev/null 2>&1
echo "dirty-after-format: $(git status --short | wc -l)" > $L/logs/$N-gates.txt
for g in "$@"; do
  case $g in check) c="pnpm check";; parity) c="pnpm test:parity";; e2e) c="pnpm test:e2e";; ci) c="bash $L/ci-extra.sh";; esac
  flock $L/heavy-gates.lock $c > $L/logs/$N-$g.txt 2>&1
  echo "$g=$?" >> $L/logs/$N-gates.txt
done
echo done >> $L/logs/$N-gates.txt
