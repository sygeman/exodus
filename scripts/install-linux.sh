#!/bin/bash
set -e

RELEASE_URL="https://github.com/sygeman/exodus/releases/latest/download"
TARBALL="stable-linux-x64-Exodus.tar.zst"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

echo "Downloading Exodus for Linux..."
curl -fsSL "$RELEASE_URL/$TARBALL" -o "$TMP_DIR/$TARBALL"

echo "Extracting..."
tar --zstd -xf "$TMP_DIR/$TARBALL" -C "$TMP_DIR"

APP_NAME="Exodus"
APP_DIR="$HOME/.local/share/exodus.sgmn.dev/stable/app"
APPLICATIONS_DIR="$HOME/.local/share/applications"
BIN_DIR="$HOME/.local/bin"

echo "Installing to $APP_DIR..."
rm -rf "$APP_DIR"
mkdir -p "$(dirname "$APP_DIR")"
mv "$TMP_DIR/$APP_NAME" "$APP_DIR"

# Ensure launcher is executable
chmod +x "$APP_DIR/bin/launcher"

# CEF sandbox requires setuid bit on chrome-sandbox for proper process isolation.
# Without it the app silently fails on most modern Linux distributions.
CHROME_SANDBOX="$APP_DIR/bin/chrome-sandbox"
if [ -f "$CHROME_SANDBOX" ]; then
  if chmod 4755 "$CHROME_SANDBOX" 2>/dev/null; then
    echo "Set setuid bit on chrome-sandbox"
  else
    echo "WARNING: Could not set setuid bit on chrome-sandbox (requires root)."
    echo "         The app may fail to start. Try running:"
    echo "           sudo chmod 4755 $CHROME_SANDBOX"
  fi
fi

# Find icon in app bundle
ICON_PATH=""
for path in "$APP_DIR/Resources/appIcon.png" "$APP_DIR/Resources/app/icon.png"; do
  if [ -f "$path" ]; then
    ICON_PATH="$path"
    break
  fi
done

mkdir -p "$APPLICATIONS_DIR"

cat > "$APPLICATIONS_DIR/exodus.desktop" << EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=Exodus
Comment=Exodus application
Exec="$APP_DIR/bin/launcher" %u
TryExec=$APP_DIR/bin/launcher
Icon=${ICON_PATH:-$APP_DIR/Resources/appIcon.png}
Terminal=false
StartupWMClass=Exodus
StartupNotify=true
Categories=Utility;Application;
EOF

chmod +x "$APPLICATIONS_DIR/exodus.desktop"
echo "Added Exodus to applications menu"

mkdir -p "$BIN_DIR"
ln -sf "$APP_DIR/bin/launcher" "$BIN_DIR/exodus"
echo "Created symlink: exodus -> $APP_DIR/bin/launcher"

if command -v update-desktop-database &> /dev/null; then
  update-desktop-database "$APPLICATIONS_DIR" 2>/dev/null || true
fi

if command -v gio &> /dev/null; then
  gio set "$APPLICATIONS_DIR/exodus.desktop" metadata::trusted true 2>/dev/null || true
fi

echo "Exodus installed successfully! Run 'exodus' from terminal or find it in your app menu."
