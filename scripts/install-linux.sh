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
TARBALL="stable-linux-x64-Exodus.tar.zst"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

APP_NAME="Exodus"
OPT_DIR="/opt/Exodus"
APPLICATIONS_DIR="/usr/share/applications"

# Find a bin directory that is in user's PATH
BIN_DIR=""
for dir in /usr/local/bin /usr/bin /bin; do
  if echo "$PATH" | grep -q "$dir"; then
    BIN_DIR="$dir"
    break
  fi
done

# Fallback if none found
if [ -z "$BIN_DIR" ]; then
  BIN_DIR="/usr/local/bin"
fi

BIN_SYMLINK="$BIN_DIR/exodus"

echo ""
log_info "Exodus Linux Installer"
log_info "======================"
echo ""

# ── Root check ─────────────────────────────────────────────────────────────
if [ "$EUID" -ne 0 ]; then
  error_exit "This installer must be run as root (e.g. sudo $0)"
fi
log_ok "Running as root"

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
log_info "Installing to $OPT_DIR..."

if [ -d "$OPT_DIR" ]; then
  rm -rf "$OPT_DIR"
  log_info "Removed previous installation"
fi

mv "$TMP_DIR/$APP_NAME" "$OPT_DIR"
log_ok "Installed application files"

# ── Permissions ────────────────────────────────────────────────────────────
log_info "Setting permissions..."

chmod +x "$OPT_DIR/bin/launcher"
log_ok "launcher is executable"

# CEF sandbox requires setuid bit on chrome-sandbox
CHROME_SANDBOX="$OPT_DIR/bin/chrome-sandbox"
if [ -f "$CHROME_SANDBOX" ]; then
  chmod 4755 "$CHROME_SANDBOX"
  log_ok "Set setuid bit on chrome-sandbox"
else
  log_warn "chrome-sandbox not found — skipping setuid setup"
fi

# ── Icon ───────────────────────────────────────────────────────────────────
ICON_PATH=""
for path in "$OPT_DIR/Resources/appIcon.png" "$OPT_DIR/Resources/app/icon.png"; do
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
Exec=$OPT_DIR/bin/launcher %u
TryExec=$OPT_DIR/bin/launcher
Icon=${ICON_PATH:-$OPT_DIR/Resources/appIcon.png}
Terminal=false
StartupWMClass=Exodus
StartupNotify=true
Categories=Utility;Application;
EOF

chmod +x "$APPLICATIONS_DIR/exodus.desktop"
log_ok "Desktop entry created at $APPLICATIONS_DIR/exodus.desktop"

# ── Symlink ────────────────────────────────────────────────────────────────
log_info "Creating command-line symlink..."

ln -sf "$OPT_DIR/bin/launcher" "$BIN_SYMLINK"

if [ -L "$BIN_SYMLINK" ] && [ -x "$BIN_SYMLINK" ]; then
  log_ok "Symlink: $BIN_SYMLINK -> $OPT_DIR/bin/launcher"
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

# ── Post-install validation ────────────────────────────────────────────────
echo ""
log_info "Running post-install validation..."

if file "$OPT_DIR/bin/launcher" | grep -q "ELF"; then
  log_ok "Launcher is a valid ELF binary"
else
  log_warn "Launcher may have issues (not a valid ELF binary)"
fi

MISSING_LIBS=0
for lib in libcef.so libNativeWrapper.so libasar.so; do
  if [ ! -f "$OPT_DIR/bin/$lib" ]; then
    log_warn "Missing library: $lib"
    MISSING_LIBS=$((MISSING_LIBS + 1))
  fi
done

if [ $MISSING_LIBS -eq 0 ]; then
  log_ok "All critical libraries present"
fi

if command -v ldd &>/dev/null; then
  MISSING_DEPS=$(ldd "$OPT_DIR/bin/launcher" 2>/dev/null | grep "not found" || true)
  if [ -n "$MISSING_DEPS" ]; then
    log_warn "Missing system dependencies:"
    echo "$MISSING_DEPS" | while read -r line; do
      echo "    $line"
    done
  else
    log_ok "All dynamic dependencies satisfied"
  fi
fi

# Verify chrome-sandbox setuid
if [ -f "$CHROME_SANDBOX" ]; then
  SANDBOX_PERMS=$(stat -c "%a" "$CHROME_SANDBOX" 2>/dev/null || stat -f "%Lp" "$CHROME_SANDBOX" 2>/dev/null)
  if [ "$SANDBOX_PERMS" = "4755" ]; then
    log_ok "chrome-sandbox setuid is correct"
  else
    log_warn "chrome-sandbox setuid is $SANDBOX_PERMS (expected 4755)"
  fi
fi

# ── Done ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}Exodus installed successfully!${NC}"
echo ""
echo "  Run from terminal: ${BLUE}exodus${NC}"
echo "  Or find it in your applications menu."
echo ""

if [ "$BIN_DIR" = "/usr/local/bin" ]; then
  echo "  If 'exodus' command is not found, add to your shell config:"
  echo "    ${YELLOW}export PATH=\"/usr/local/bin:\$PATH\"${NC}"
  echo ""
fi
