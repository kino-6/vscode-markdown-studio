#!/bin/bash
set -euo pipefail

# Markdown Studio — acceptance check in an isolated VS Code
#
# Builds the VSIX and starts an empty VS Code with its own settings folder and
# its own extensions folder, so only Markdown Studio (plus a PDF viewer to open
# exported PDFs) is installed and your normal VS Code profile is untouched.
# Opens a fresh copy of examples/ and icon/ (so PDF exports never overwrite the
# committed examples) with demo.md shown.
#
# Usage:
#   scripts/dev/acceptance.sh          # build, install, launch
#   scripts/dev/acceptance.sh --reset  # also wipe the isolated profile first

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

PROFILE_DIR="$REPO_ROOT/ignore/acceptance-profile"
# VS Code creates a Unix socket inside the user-data folder, and macOS limits
# socket paths to ~103 characters, so keep the profile on a short path.
VSCODE_PROFILE_DIR="/tmp/markdown-studio-acceptance"
USER_DATA_DIR="$VSCODE_PROFILE_DIR/user-data"
EXTENSIONS_DIR="$VSCODE_PROFILE_DIR/extensions"
WORKSPACE_DIR="$PROFILE_DIR/workspace"

VERSION=$(node -p "require('./package.json').version")
NAME=$(node -p "require('./package.json').name")
VSIX_PATH="dist/${NAME}-${VERSION}.vsix"

if [[ "${1:-}" == "--reset" ]]; then
  echo "Resetting isolated profile: $VSCODE_PROFILE_DIR and $PROFILE_DIR"
  rm -rf "$VSCODE_PROFILE_DIR" "$PROFILE_DIR"
fi
mkdir -p "$USER_DATA_DIR/User" "$EXTENSIONS_DIR"

# Settings for the isolated profile only: skip the Workspace Trust prompt
# (restricted mode would keep the extension from running), the welcome page,
# and the Copilot sign-in dialog a fresh profile shows.
SETTINGS_FILE="$USER_DATA_DIR/User/settings.json"
if [[ ! -f "$SETTINGS_FILE" ]] || ! grep -q git.openRepositoryInParentFolders "$SETTINGS_FILE"; then
  cat > "$SETTINGS_FILE" <<'JSON'
{
  "security.workspace.trust.enabled": false,
  "workbench.startupEditor": "none",
  "chat.disableAIFeatures": true,
  "git.openRepositoryInParentFolders": "never"
}
JSON
fi

echo "[1/3] Building ${VSIX_PATH}..."
npm run package --silent

echo "[2/3] Installing into the isolated profile..."
NODE_OPTIONS="--no-deprecation" code \
  --user-data-dir "$USER_DATA_DIR" \
  --extensions-dir "$EXTENSIONS_DIR" \
  --install-extension "$VSIX_PATH" --force

# VS Code cannot show PDFs by itself; add a viewer so exported PDFs open in
# the editor. Downloads from the Marketplace; failure (e.g. offline) is not fatal.
PDF_VIEWER="tomoki1207.pdf"
if ! NODE_OPTIONS="--no-deprecation" code \
  --user-data-dir "$USER_DATA_DIR" \
  --extensions-dir "$EXTENSIONS_DIR" \
  --install-extension "$PDF_VIEWER"; then
  echo "Warning: could not install the PDF viewer ($PDF_VIEWER). PDFs will not open inside VS Code."
fi

INSTALLED=$(NODE_OPTIONS="--no-deprecation" code \
  --user-data-dir "$USER_DATA_DIR" \
  --extensions-dir "$EXTENSIONS_DIR" \
  --list-extensions)
echo "Installed extensions in this profile:"
echo "$INSTALLED" | sed 's/^/  /'

echo "[3/3] Copying examples/ and icon/ to $WORKSPACE_DIR and launching VS Code..."
# Same layout as the repo: examples/demo.md refers to ../icon/ for its images.
rm -rf "$WORKSPACE_DIR"
mkdir -p "$WORKSPACE_DIR"
cp -R "$REPO_ROOT/examples" "$WORKSPACE_DIR/examples"
cp -R "$REPO_ROOT/icon" "$WORKSPACE_DIR/icon"
NODE_OPTIONS="--no-deprecation" code \
  --new-window \
  --user-data-dir "$USER_DATA_DIR" \
  --extensions-dir "$EXTENSIONS_DIR" \
  "$WORKSPACE_DIR" "$WORKSPACE_DIR/examples/demo.md"

echo "Done. In the new window: preview and export examples/demo.md, then see examples/acceptance/ACCEPTANCE.md for the new features."
