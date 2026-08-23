#!/usr/bin/env bash
# Sync checkout → ~/.dsh real installs (plugin + skill). Requires web profile.
# This script deliberately delegates profile mutations to dsh. It never approves
# unrelated install scripts or edits profile/node_modules as a fallback.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="${HOME}/.dsh/plugins/dsh-canvas-viewer"
SKILL_DEST="${HOME}/.dsh/skills/canvas-analysis-report"
PROFILE="${HOME}/.dsh/profiles/web"
PKG="dsh-canvas-viewer"

if ! command -v dsh >/dev/null 2>&1; then
  echo "dsh CLI is required; plugin files were not installed." >&2
  exit 1
fi
if [ ! -d "$PROFILE" ]; then
  echo "web profile not found: $PROFILE" >&2
  echo "Create it with dsh --profile web --dump-config, then retry." >&2
  exit 1
fi
node "$ROOT/scripts/sync-skill-mirrors.mjs" --check

mkdir -p "$DEST"
rsync -a \
  --delete \
  --include='lib/***' --include='skills/***' --include='docs/***' --include='assets/***' \
  --include='package.json' --include='cordis.patch.yml' \
  --include='README.md' --include='AGENTS.md' --include='LICENSE' --include='CHANGELOG.md' \
  --include='THIRD-PARTY-NOTICES.md' \
  --exclude='*' \
  "$ROOT/" "$DEST/"

rm -rf "$SKILL_DEST"
cp -R "$ROOT/skills/canvas-analysis-report" "$SKILL_DEST"

if ! dsh plugin --profile web add "file:$DEST"; then
  echo "dsh plugin add failed; no unrelated build approvals or profile edits were attempted." >&2
  echo "Inspect the dsh/pnpm error, then retry this command explicitly." >&2
  exit 1
fi
echo "Synced plugin → $DEST"
echo "Synced skill  → $SKILL_DEST"
echo "Restart dsh web to load Host changes."
