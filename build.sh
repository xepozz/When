#!/usr/bin/env bash
# Builds the Chrome Web Store upload zip from ./extension
set -euo pipefail
cd "$(dirname "$0")"
VERSION=$(node -e "console.log(require('./extension/manifest.json').version)")
OUT="dist/sitesweep-$VERSION.zip"
mkdir -p dist
rm -f "$OUT"
( cd extension && zip -qr "../$OUT" . -x '*.DS_Store' )
node -e "JSON.parse(require('fs').readFileSync('extension/manifest.json','utf8')); console.log('manifest ok')"
ls -la "$OUT"
