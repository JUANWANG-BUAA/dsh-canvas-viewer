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

# Optional transport overrides for profiles that contain unrelated Git/npm
# dependencies. They are scoped to this process and never modify global Git
# configuration or the profile manifest:
#   DSH_GIT_URL_BASE=https://github.com/  # rewrite GitHub SSH URLs once
#   DSH_NPM_REGISTRY=https://registry.npmjs.org
#   DSH_PNPM_NO_OPTIONAL=1               # skip unrelated platform optionals
GIT_CONFIG_TMP=""
cleanup_transport_overrides() {
  if [ -n "$GIT_CONFIG_TMP" ] && [ -f "$GIT_CONFIG_TMP" ]; then
    rm -f "$GIT_CONFIG_TMP"
  fi
}
trap cleanup_transport_overrides EXIT

if [ -n "${DSH_GIT_URL_BASE:-}" ]; then
  GIT_CONFIG_TMP="$(mktemp "${TMPDIR:-/tmp}/dsh-canvas-git.XXXXXX")"
  # Keep the user's existing helpers/proxies, then add only the requested
  # rewrite. pnpm may sanitize GIT_CONFIG_COUNT, so a scoped global file is
  # more reliable for nested git clones.
  if [ -f "${HOME}/.gitconfig" ]; then
    cp "${HOME}/.gitconfig" "$GIT_CONFIG_TMP"
  fi
  GIT_BASE="${DSH_GIT_URL_BASE%/}/"
  git config --file "$GIT_CONFIG_TMP" --add url."$GIT_BASE".insteadOf "git@github.com:"
  git config --file "$GIT_CONFIG_TMP" --add url."$GIT_BASE".insteadOf "ssh://git@github.com/"
  git config --file "$GIT_CONFIG_TMP" --add url."$GIT_BASE".insteadOf "git+ssh://git@github.com/"
  export GIT_CONFIG_GLOBAL="$GIT_CONFIG_TMP"
  echo "Using process-scoped Git transport override: $DSH_GIT_URL_BASE" >&2
fi

PNPM_ADD_ARGS=()
if [ -n "${DSH_NPM_REGISTRY:-}" ]; then
  PNPM_ADD_ARGS+=(--registry="$DSH_NPM_REGISTRY")
  echo "Using npm registry override: $DSH_NPM_REGISTRY" >&2
fi
if [ "${DSH_PNPM_NO_OPTIONAL:-}" = "1" ]; then
  PNPM_ADD_ARGS+=(--no-optional)
  echo "Skipping optional profile packages for this refresh" >&2
fi

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
  --include='src/***' --include='tsconfig.json' \
  --include='package.json' --include='cordis.patch.yml' \
  --include='README.md' --include='AGENTS.md' --include='LICENSE' --include='CHANGELOG.md' \
  --include='README.en.md' \
  --include='THIRD-PARTY-NOTICES.md' \
  --exclude='*' \
  "$ROOT/" "$DEST/"

rm -rf "$SKILL_DEST"
cp -R "$ROOT/skills/canvas-analysis-report" "$SKILL_DEST"

dsh_plugin_add() {
  dsh plugin --profile web add "${PNPM_ADD_ARGS[@]}" "$1"
}

if ! dsh_plugin_add "file:$DEST"; then
  echo "dsh plugin add failed; no unrelated build approvals or profile edits were attempted." >&2
  echo "Inspect the dsh/pnpm error, then retry this command explicitly." >&2
  exit 1
fi

# pnpm can reuse a same-version local file package even after its checkout
# changed. Verify the actual profile copy, then use dsh's scoped remove/add
# fallback only when the first add left stale files behind. No profile JSON or
# unrelated dependency is edited directly.
verify_profile_copy() {
  local installed="$PROFILE/node_modules/$PKG"
  local file
  for file in \
    package.json \
    lib/index.js \
    lib/client.js \
    lib/host/paths.mjs \
    lib/host/compiler.mjs \
    lib/host/hot-reload.mjs \
    lib/host/http.mjs \
    lib/host/assets.mjs \
    src/host/assets.mts \
    tsconfig.json \
    README.en.md; do
    [ -f "$installed/$file" ] || return 1
    cmp -s "$DEST/$file" "$installed/$file" || return 1
  done
}

if ! verify_profile_copy; then
  echo "dsh profile kept a stale same-version local package; refreshing only $PKG via dsh." >&2
  dsh plugin --profile web remove "$PKG"
  dsh_plugin_add "file:$DEST"
fi
if ! verify_profile_copy; then
  echo "profile refresh failed: $PROFILE/node_modules/$PKG is stale or incomplete." >&2
  exit 1
fi
echo "Synced plugin → $DEST"
echo "Synced skill  → $SKILL_DEST"
echo "Restart dsh web to load Host changes."
