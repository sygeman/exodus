#!/bin/bash
set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_ok()   { echo -e "${GREEN}[OK]${NC}   $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_err()  { echo -e "${RED}[ERR]${NC}  $1"; }

error_exit() {
  log_err "$1"
  exit 1
}

RELEASE_URL="https://github.com/sygeman/exodus/releases/latest/download"

# Detect architecture
ARCH=$(uname -m)
case "$ARCH" in
  x86_64)
    ARCH_NAME="x64"
    ;;
  aarch64|arm64)
    ARCH_NAME="arm64"
    ;;
  *)
    error_exit "Unsupported architecture: $ARCH (expected x86_64 or aarch64/arm64)"
    ;;
esac

TARBALL="stable-linux-${ARCH_NAME}-Exodus.tar.zst"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

APP_NAME="Exodus"
# Install to the same path that Electrobun updater uses for auto-updates
# identifier=exodus.sgmn.dev, channel=stable
APP_DIR="$HOME/.local/share/exodus.sgmn.dev/stable/app"
APPLICATIONS_DIR="$HOME/.local/share/applications"
BIN_DIR="$HOME/.local/bin"

echo ""
log_info "Exodus Linux Installer (User)"
log_info "============================="
log_info "Architecture: $ARCH ($ARCH_NAME)"
echo ""

# ── Pre-flight checks ──────────────────────────────────────────────────────
log_info "Checking dependencies..."

if ! tar --zstd --help &>/dev/null; then
  error_exit "tar does not support zstd. Install zstd (e.g. apt install zstd)"
fi
log_ok "tar supports zstd"

if ! command -v curl &>/dev/null; then
  error_exit "curl is required but not installed"
fi
log_ok "curl found"

# ── Ensure directories exist ───────────────────────────────────────────────
mkdir -p "$APPLICATIONS_DIR"
mkdir -p "$BIN_DIR"

# ── Download ───────────────────────────────────────────────────────────────
log_info "Downloading $TARBALL..."

HTTP_CODE=$(curl -fsSL -w "%{http_code}" -L "$RELEASE_URL/$TARBALL" -o "$TMP_DIR/$TARBALL" 2>/dev/null) || {
  error_exit "Download failed. Check your internet connection and that the release exists."
}

if [ "$HTTP_CODE" != "200" ]; then
  error_exit "Download returned HTTP $HTTP_CODE. Release may not exist yet."
fi

FILE_SIZE=$(stat -c%s "$TMP_DIR/$TARBALL" 2>/dev/null || stat -f%z "$TMP_DIR/$TARBALL" 2>/dev/null)
log_ok "Downloaded ${FILE_SIZE} bytes"

# ── Extract ────────────────────────────────────────────────────────────────
log_info "Extracting archive..."

if ! tar --zstd -xf "$TMP_DIR/$TARBALL" -C "$TMP_DIR" 2>/dev/null; then
  error_exit "Failed to extract archive. File may be corrupted."
fi

if [ ! -d "$TMP_DIR/$APP_NAME" ]; then
  error_exit "Archive does not contain expected '$APP_NAME' directory"
fi

if [ ! -f "$TMP_DIR/$APP_NAME/bin/launcher" ]; then
  error_exit "Archive is missing bin/launcher executable"
fi

log_ok "Archive extracted and validated"

# ── Install ────────────────────────────────────────────────────────────────
log_info "Installing to $APP_DIR..."

if [ -d "$APP_DIR" ]; then
  rm -rf "$APP_DIR"
  log_info "Removed previous installation"
fi

mv "$TMP_DIR/$APP_NAME" "$APP_DIR"
log_ok "Installed application files"

# ── Permissions ────────────────────────────────────────────────────────────
log_info "Setting permissions..."

chmod +x "$APP_DIR/bin/launcher"
log_ok "launcher is executable"

# ── Icon ───────────────────────────────────────────────────────────────────
ICON_PATH=""
for path in "$APP_DIR/Resources/appIcon.png" "$APP_DIR/Resources/app/icon.png"; do
  if [ -f "$path" ]; then
    ICON_PATH="$path"
    break
  fi
done

if [ -n "$ICON_PATH" ]; then
  log_ok "Found icon at $ICON_PATH"
else
  log_warn "No icon found"
fi

# ── Desktop entry ──────────────────────────────────────────────────────────
log_info "Creating desktop entry..."

cat > "$APPLICATIONS_DIR/exodus.desktop" << EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=Exodus
Comment=Exodus application
Exec=$APP_DIR/bin/launcher %u
TryExec=$APP_DIR/bin/launcher
Icon=${ICON_PATH:-$APP_DIR/Resources/appIcon.png}
Terminal=false
StartupWMClass=Exodus
StartupNotify=true
Categories=Utility;Application;
EOF

chmod +x "$APPLICATIONS_DIR/exodus.desktop"
log_ok "Desktop entry created at $APPLICATIONS_DIR/exodus.desktop"

# ── Symlink ────────────────────────────────────────────────────────────────
log_info "Creating command-line symlink..."

ln -sf "$APP_DIR/bin/launcher" "$BIN_DIR/exodus"

if [ -L "$BIN_DIR/exodus" ] && [ -x "$BIN_DIR/exodus" ]; then
  log_ok "Symlink: $BIN_DIR/exodus -> $APP_DIR/bin/launcher"
else
  log_warn "Symlink created but may not be accessible"
fi

# ── Update desktop database ────────────────────────────────────────────────
if command -v update-desktop-database &>/dev/null; then
  if update-desktop-database "$APPLICATIONS_DIR" 2>/dev/null; then
    log_ok "Updated desktop database"
  else
    log_warn "Failed to update desktop database"
  fi
fi

# ── Remove old installation ────────────────────────────────────────────────
OLD_APP_DIR="$HOME/.local/share/Exodus"
if [ -d "$OLD_APP_DIR" ] && [ "$OLD_APP_DIR" != "$APP_DIR" ]; then
  log_info "Removing old installation from $OLD_APP_DIR..."
  rm -rf "$OLD_APP_DIR"
  log_ok "Old installation removed"
fi

# ── Post-install validation ────────────────────────────────────────────────
echo ""
log_info "Running post-install validation..."

if file "$APP_DIR/bin/launcher" | grep -q "ELF"; then
  log_ok "Launcher is a valid ELF binary"
else
  log_warn "Launcher may have issues (not a valid ELF binary)"
fi

MISSING_LIBS=0
for lib in libNativeWrapper.so libasar.so; do
  if [ ! -f "$APP_DIR/bin/$lib" ]; then
    log_warn "Missing library: $lib"
    MISSING_LIBS=$((MISSING_LIBS + 1))
  fi
done

if [ $MISSING_LIBS -eq 0 ]; then
  log_ok "All critical libraries present"
fi

if command -v ldd &>/dev/null; then
  MISSING_DEPS=$(ldd "$APP_DIR/bin/launcher" 2>/dev/null | grep "not found" || true)
  if [ -n "$MISSING_DEPS" ]; then
    log_warn "Missing system dependencies:"
    echo "$MISSING_DEPS" | while read -r line; do
      echo "    $line"
    done
  else
    log_ok "All dynamic dependencies satisfied"
  fi
fi

# ── Done ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}Exodus installed successfully!${NC}"
echo ""
echo "  Run from terminal: ${BLUE}exodus${NC}"
echo "  Or find it in your applications menu."
echo ""

if ! echo "$PATH" | grep -q "$BIN_DIR"; then
  echo "  ${YELLOW}Warning:${NC} $BIN_DIR is not in your PATH."
  echo "  Add to your shell config (e.g. ~/.bashrc or ~/.zshrc):"
  echo "    ${YELLOW}export PATH=\"$BIN_DIR:\$PATH\"${NC}"
  echo ""
fi
