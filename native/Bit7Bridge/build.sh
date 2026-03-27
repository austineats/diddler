#!/bin/bash
# Build Bit7Bridge standalone executable
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
OUTPUT="$DIR/Bit7Bridge"

echo "Building Bit7Bridge standalone..."

clang \
  -framework Foundation \
  -F /System/Library/PrivateFrameworks \
  -o "$OUTPUT" \
  "$DIR/Bit7Bridge.m" \
  -fobjc-arc \
  -Wno-deprecated-declarations \
  -arch arm64

codesign -f -s - --entitlements "$DIR/Bit7Bridge.entitlements" "$OUTPUT" 2>/dev/null || true
echo "Built: $OUTPUT"
echo "Signed (ad-hoc with entitlements)"
