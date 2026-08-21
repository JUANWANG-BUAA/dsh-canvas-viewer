#!/usr/bin/env bash
# Sync checkout → ~/.dsh real installs (plugin + skill). Requires web profile.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="${HOME}/.dsh/plugins/dsh-canvas-viewer"
SKILL_DEST="${HOME}/.dsh/skills/canvas-analysis-report"

rm -rf "$DEST"
mkdir -p "$DEST"
rsync -a \
  --include='lib/***' --include='skills/***' --include='docs/***' \
  --include='package.json' --include='cordis.patch.yml' \
  --include='README.md' --include='AGENTS.md' --include='LICENSE' --include='CHANGELOG.md' \
  --exclude='*' \
  "$ROOT/" "$DEST/"

rm -rf "$SKILL_DEST"
cp -R "$ROOT/skills/canvas-analysis-report" "$SKILL_DEST"

dsh plugin --profile web remove dsh-canvas-viewer >/dev/null 2>&1 || true
dsh plugin --profile web add "file:$DEST"
echo "Synced plugin → $DEST"
echo "Synced skill  → $SKILL_DEST"
echo "Restart dsh web to load Host changes."
