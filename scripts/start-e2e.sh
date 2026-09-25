#!/usr/bin/env sh
# Serves the production build for the end to end suite.
#
# The standalone output ships only the traced server files: the static assets
# and the public folder are copied next to it, as the Dockerfile does.
# Usage: scripts/start-e2e.sh [port]   (build first with `npm run build`)
set -eu

cd "$(dirname "$0")/.."
PORT="${1:-${PORT:-3000}}"

if [ ! -f .next/standalone/server.js ]; then
  echo "No production build found. Run 'npm run build' first." >&2
  exit 1
fi

rm -rf .next/standalone/.next/static .next/standalone/public
cp -R .next/static .next/standalone/.next/static
cp -R public .next/standalone/public

export NODE_ENV=production
export PORT
export HOSTNAME="${E2E_HOSTNAME:-127.0.0.1}"
exec node .next/standalone/server.js
