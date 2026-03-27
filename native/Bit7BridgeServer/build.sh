#!/bin/bash
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
OUTPUT="$DIR/Bit7BridgeServer"

echo "Building Bit7BridgeServer..."

clang \
  -target arm64e-apple-macos15.0 \
  -framework Foundation \
  -F /System/Library/PrivateFrameworks \
  -framework IMCore \
  -o "$OUTPUT" \
  "$DIR/Bit7BridgeServer.m" \
  -fobjc-arc \
  -Wno-deprecated-declarations

echo "Built: $OUTPUT"
codesign -f -s - "$OUTPUT" 2>/dev/null || true
echo "Signed (ad-hoc)"
