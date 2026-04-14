#!/bin/bash
set -e

SVG="src/mainview/assets/logo.svg"
OUT_DIR="assets"
ICONSET="$OUT_DIR/icon.iconset"
ICNS="$OUT_DIR/icon.icns"
ICO="$OUT_DIR/icon.ico"
TMP_PNG="$OUT_DIR/icon_1024x1024.png"

rm -rf "$ICONSET" "$ICNS" "$ICO" "$TMP_PNG"
mkdir -p "$ICONSET"

# Convert SVG to 1024x1024 PNG with primary color
sed 's/fill="currentColor"/fill="#ffb900"/' "$SVG" | rsvg-convert -w 1024 -h 1024 -f png -o "$TMP_PNG"

# Generate macOS iconset sizes
for size in 16 32 128 256 512; do
  sips -z $size $size "$TMP_PNG" --out "$ICONSET/icon_${size}x${size}.png" >/dev/null
  sips -z $((size * 2)) $((size * 2)) "$TMP_PNG" --out "$ICONSET/icon_${size}x${size}@2x.png" >/dev/null
done

# Pack into icns
iconutil -c icns "$ICONSET" -o "$ICNS"

# Generate Windows ICO with multiple sizes
ICO_TMP_DIR=$(mktemp -d)
for size in 16 32 48 128 256; do
  convert "$TMP_PNG" -resize ${size}x${size} "$ICO_TMP_DIR/icon_${size}x${size}.png"
done
convert "$ICO_TMP_DIR"/*.png "$ICO"
rm -rf "$ICO_TMP_DIR"

# Generate Linux PNG icons
LINUX_DIR="$OUT_DIR/linux"
rm -rf "$LINUX_DIR"
mkdir -p "$LINUX_DIR"
for size in 16 32 48 64 128 256 512; do
  convert "$TMP_PNG" -resize ${size}x${size} "$LINUX_DIR/icon_${size}x${size}.png"
done

echo "Generated:"
echo "  macOS: $ICNS"
echo "  Windows: $ICO"
echo "  Linux: $LINUX_DIR/"
