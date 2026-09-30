#!/usr/bin/env bash
# Everything that should pass before committing. Fast (no servers needed);
# run `npm run test:e2e` separately for the Playwright multiplayer suite.
set -euo pipefail

npm run -s typecheck
npm run -s lint
npm run -s test
npm run -s check:megingjord
