#!/bin/bash
set -euo pipefail

# Markdown Studio — acceptance check in an isolated VS Code
#
# Builds the VSIX and starts VS Code with its own settings folder and its own
# extensions folder, so only Markdown Studio is installed and your normal
# VS Code profile is untouched. Opens examples/acceptance with a checklist.
#
# Usage:
#   scripts/dev/acceptance.sh          # build, install, launch
#   scripts/dev/acceptance.sh --reset  # also wipe the isolated profile first

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

PROFILE_DIR="$REPO_ROOT/ignore/acceptance-profile"
USER_DATA_DIR="$PROFILE_DIR/user-data"
EXTENSIONS_DIR="$PROFILE_DIR/extensions"
WORKSPACE_DIR="$REPO_ROOT/examples/acceptance"

VERSION=$(node -p "require('./package.json').version")
NAME=$(node -p "require('./package.json').name")
VSIX_PATH="dist/${NAME}-${VERSION}.vsix"

if [[ "${1:-}" == "--reset" ]]; then
  echo "Resetting isolated profile: $PROFILE_DIR"
  rm -rf "$PROFILE_DIR"
fi
mkdir -p "$USER_DATA_DIR" "$EXTENSIONS_DIR"

echo "[1/3] Building ${VSIX_PATH}..."
npm run package --silent

echo "[2/3] Installing into the isolated profile..."
NODE_OPTIONS="--no-deprecation" code \
  --user-data-dir "$USER_DATA_DIR" \
  --extensions-dir "$EXTENSIONS_DIR" \
  --install-extension "$VSIX_PATH" --force

INSTALLED=$(NODE_OPTIONS="--no-deprecation" code \
  --user-data-dir "$USER_DATA_DIR" \
  --extensions-dir "$EXTENSIONS_DIR" \
  --list-extensions)
echo "Installed extensions in this profile:"
echo "$INSTALLED" | sed 's/^/  /'

echo "[3/3] Launching VS Code..."
NODE_OPTIONS="--no-deprecation" code \
  --new-window \
  --user-data-dir "$USER_DATA_DIR" \
  --extensions-dir "$EXTENSIONS_DIR" \
  "$WORKSPACE_DIR" "$WORKSPACE_DIR/ACCEPTANCE.md"

echo "Done. Follow examples/acceptance/ACCEPTANCE.md in the new window."
