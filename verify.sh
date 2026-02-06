#!/usr/bin/env bash
set -euo pipefail

npm run typecheck
npm run test:server
npm run test:shared
