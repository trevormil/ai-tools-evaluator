#!/usr/bin/env bash
# Capture the App Store screenshot set by driving the real app in a simulator.
#
#   ./scripts/screenshots.sh                 # 6.9" (iPhone 17 Pro Max)
#   ./scripts/screenshots.sh "iPhone 16 Pro" # any booted-able simulator
#
# Output: build/screenshots/<device>/NN-name.png
# Apple requires 6.9" iPhone screenshots; smaller sizes are scaled from them.
set -euo pipefail

cd "$(dirname "$0")/.."

DEVICE="${1:-iPhone 17 Pro Max}"
OUT="$PWD/build/screenshots/${DEVICE// /-}"

rm -rf "$OUT"
mkdir -p "$OUT"

echo "==> generating project"
xcodegen generate

echo "==> capturing on $DEVICE"
# xcodebuild forwards TEST_RUNNER_-prefixed vars to the test process with the
# prefix stripped; a plain assignment would only set a build setting.
TEST_RUNNER_AIX_SCREENSHOT_DIR="$OUT" \
  xcodebuild -project AIx.xcodeproj -scheme AIxScreenshots \
  -destination "platform=iOS Simulator,name=$DEVICE" \
  test 2>&1 | tail -5

shot_count=$(ls -1 "$OUT"/*.png 2>/dev/null | wc -l | tr -d ' ')
if [ "$shot_count" = "0" ]; then
  echo "no screenshots written — check the test output above" >&2
  exit 1
fi

echo "==> $shot_count screenshots in $OUT"
sips -g pixelWidth -g pixelHeight "$OUT"/*.png 2>/dev/null | grep -E "pixel|/" || true
