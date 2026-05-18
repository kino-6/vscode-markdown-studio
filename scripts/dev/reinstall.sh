#!/bin/bash
set -euo pipefail

# Markdown Studio — 開発用クリーン再インストールスクリプト
# Usage: scripts/dev/reinstall.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

# package.json からバージョンと名前を動的取得
VERSION=$(node -p "require('./package.json').version")
NAME=$(node -p "require('./package.json').name")
PUBLISHER=$(node -p "require('./package.json').publisher")
BRANCH=$(git branch --show-current 2>/dev/null || echo HEAD)
VSIX_PATH="dist/${NAME}-${VERSION}.vsix"
EXTENSION_ID="${PUBLISHER}.${NAME}"

echo "=== Markdown Studio dev reinstall (v${VERSION}) ==="

# 1. 拡張機能を完全削除
echo "[1/6] Uninstalling ${EXTENSION_ID}..."
code --uninstall-extension "$EXTENSION_ID" 2>/dev/null || true

# 2. ServiceWorkerキャッシュ削除
echo "[2/6] Clearing ServiceWorker cache..."
rm -rf ~/Library/Application\ Support/Code/Service\ Worker/CacheStorage

# 3. Webviewキャッシュ削除
echo "[3/6] Clearing Webview cache..."
rm -rf ~/Library/Application\ Support/Code/Cache
rm -rf ~/Library/Application\ Support/Code/CachedData
rm -rf ~/Library/Application\ Support/Code/GPUCache

# 4. 拡張機能フォルダから残骸を直接削除
echo "[4/6] Removing extension remnants..."
rm -rf ~/.vscode/extensions/${EXTENSION_ID}-*

# 5. VSIXを再ビルド
echo "[5/6] Building VSIX..."
npm run build
rm -f dist/*.vsix
vsce package --githubBranch "$BRANCH" -o dist/

# 6. 再インストール
echo "[6/6] Installing ${VSIX_PATH}..."
code --install-extension "$VSIX_PATH"

echo ""
echo "✅ Done! Restart VS Code to activate v${VERSION}."
