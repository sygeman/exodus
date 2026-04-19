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

APP_NAME="Exodus"
# Aligned with Electrobun updater path: identifier=exodus.sgmn.dev, channel=stable
APP_DIR="$HOME/.local/share/exodus.sgmn.dev/stable/app"
OLD_APP_DIR="$HOME/.local/share/Exodus"
APPLICATIONS_DIR="$HOME/.local/share/applications"
BIN_DIR="$HOME/.local/bin"

echo ""
log_info "Exodus Linux Uninstaller"
log_info "========================"
echo ""

# ── Remove application files ───────────────────────────────────────────────
log_info "Removing application files..."

if [ -d "$APP_DIR" ]; then
  rm -rf "$APP_DIR"
  log_ok "Removed $APP_DIR"
else
  log_warn "$APP_DIR not found — skipping"
fi

if [ -d "$OLD_APP_DIR" ]; then
  rm -rf "$OLD_APP_DIR"
  log_ok "Removed old installation $OLD_APP_DIR"
fi

# ── Remove desktop entry ───────────────────────────────────────────────────
log_info "Removing desktop entry..."

DESKTOP_ENTRY="$APPLICATIONS_DIR/exodus.desktop"
if [ -f "$DESKTOP_ENTRY" ]; then
  rm -f "$DESKTOP_ENTRY"
  log_ok "Removed $DESKTOP_ENTRY"
else
  log_warn "$DESKTOP_ENTRY not found — skipping"
fi

# ── Remove command-line symlink ────────────────────────────────────────────
log_info "Removing command-line symlink..."

link="$BIN_DIR/exodus"
if [ -L "$link" ]; then
  rm -f "$link"
  log_ok "Removed symlink $link"
else
  log_warn "$link not found — skipping"
fi

# ── Update desktop database ────────────────────────────────────────────────
if command -v update-desktop-database &>/dev/null; then
  if update-desktop-database "$APPLICATIONS_DIR" 2>/dev/null; then
    log_ok "Updated desktop database"
  else
    log_warn "Failed to update desktop database"
  fi
fi

# ── Done ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}Exodus uninstalled successfully!${NC}"
echo ""
log_info "To remove user data as well, run:"
echo "  ${YELLOW}rm -rf ~/.config/Exodus ~/.cache/Exodus${NC}"
echo ""
