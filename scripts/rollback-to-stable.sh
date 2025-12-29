#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   ./scripts/rollback-to-stable.sh <REF> [TARGET_BRANCH]
#
# Examples:
#   ./scripts/rollback-to-stable.sh prod-stable-2025-12-28-docs
#   ./scripts/rollback-to-stable.sh prod-stable-2025-12-28-docs main
#   ./scripts/rollback-to-stable.sh 7512b52 main
#
REF="${1:-prod-stable-2025-12-28-docs}"
TARGET_BRANCH="${2:-main}"
REMOTE="${REMOTE:-origin}"

timestamp="$(date +%Y%m%d-%H%M%S)"
BACKUP_BRANCH="prod-backup-${TARGET_BRANCH}-${timestamp}"

echo "==> Safety checks..."
if [[ -n "$(git status --porcelain)" ]]; then
  echo "❌ Working tree is not clean. Commit or stash changes before rolling back."
  git status --porcelain
  exit 1
fi

echo "==> Fetching latest branches and tags..."
git fetch --all --tags --prune

echo "==> Verifying rollback ref exists: ${REF}"
git rev-parse --verify "${REF}^{commit}" >/dev/null

echo "==> Checking out '${TARGET_BRANCH}'..."
git checkout "${TARGET_BRANCH}"

echo "==> Syncing '${TARGET_BRANCH}' with ${REMOTE}/${TARGET_BRANCH}..."
git pull --ff-only "${REMOTE}" "${TARGET_BRANCH}"

echo "==> Creating backup branch '${BACKUP_BRANCH}' from current '${TARGET_BRANCH}'..."
git branch "${BACKUP_BRANCH}"
git push -u "${REMOTE}" "${BACKUP_BRANCH}"

echo "==> Rolling back '${TARGET_BRANCH}' to '${REF}'..."
git reset --hard "${REF}"

echo "==> Pushing '${TARGET_BRANCH}' to ${REMOTE} (force-with-lease) so production deploys..."
git push "${REMOTE}" "${TARGET_BRANCH}" --force-with-lease

echo ""
echo "✅ Rollback complete."
echo "   - Target branch: ${TARGET_BRANCH}"
echo "   - Rolled back to: ${REF} ($(git rev-parse --short HEAD))"
echo "   - Backup branch: ${BACKUP_BRANCH}"
echo ""
echo "Next: Confirm Cloudflare Pages shows a PRODUCTION deploy for '${TARGET_BRANCH}', then verify the live site."
