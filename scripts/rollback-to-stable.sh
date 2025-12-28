#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   ./scripts/rollback-to-stable.sh
#   ./scripts/rollback-to-stable.sh prod-stable-2025-12-28 rollback-to-stable
#
TAG="${1:-prod-stable-2025-12-28}"
BRANCH="${2:-rollback-to-stable}"

echo "==> Fetching latest tags..."
git fetch --all --tags

echo "==> Creating/resetting branch '${BRANCH}' to tag '${TAG}'..."
git checkout -B "${BRANCH}" "${TAG}"

echo "==> Pushing branch '${BRANCH}' to origin (force) so Cloudflare can deploy it..."
git push -u origin "${BRANCH}" --force

echo ""
echo "✅ Rollback branch pushed successfully."
echo "Next: Deploy branch '${BRANCH}' in Cloudflare Pages."
