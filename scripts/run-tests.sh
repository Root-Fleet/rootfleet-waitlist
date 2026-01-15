#!/usr/bin/env bash
set -euo pipefail

SUITE="${1:-unit}"

case "$SUITE" in
  unit)
    npm run test:unit
    ;;
  integration)
    npm run test:integration
    ;;
  e2e)
    npm run test:e2e
    ;;
  smoke)
    npm run test:smoke
    ;;
  ci)
    npm run test:ci
    ;;
  *)
    echo "Unknown suite: $SUITE"
    echo "Use one of: unit | integration | e2e | smoke | ci"
    exit 1
    ;;
esac
