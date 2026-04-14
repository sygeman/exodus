#!/bin/bash
set -e

SVG="src/mainview/assets/logo.svg"
OUT_DIR="assets"
ICONSET="$OUT_DIR/icon.iconset"
ICNS="$OUT_DIR/icon.icns"
TMP_PNG="$OUT_DIR/icon_1024x1024.png"

rm -rf "$ICONSET" "$ICNS" "$TMP_PNG"
mkdir -p "$ICONSET"

# Convert SVG to 1024x1024 PNG with primary color
sed 's/fill="currentColor"/fill="#ffb900"/' "$SVG" | rsvg-convert -w 1024 -h 1024 -f png -o "$TMP_PNG"

# Generate iconset sizes
for size in 16 32 128 256 512; do
  sips -z $size $size "$TMP_PNG" --out "$ICONSET/icon_${size}x${size}.png" >/dev/null
  sips -z $((size * 2)) $((size * 2)) "$TMP_PNG" --out "$ICONSET/icon_${size}x${size}@2x.png" >/dev/null
done

# Pack into icns
iconutil -c icns "$ICONSET" -o "$ICNS"

echo "Generated: $ICNS"
