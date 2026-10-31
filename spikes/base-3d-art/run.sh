#!/usr/bin/env bash
# Builds the spike and captures the given queries into $1. Needs Node 24 at /opt/node24 and the static server on 4791.
set -e
here=$(cd "$(dirname "$0")" && pwd)
out=$1; shift
/opt/node24/bin/node "$here/../../games/base-3d/node_modules/vite/bin/vite.js" build --config "$here/vite.config.mjs" --logLevel error
cd "$here" && node capture.mjs http://127.0.0.1:4791/index.html "$out" "$@"
