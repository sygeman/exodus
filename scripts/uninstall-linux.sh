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
OPT_DIR="/opt/Exodus"
APPLICATIONS_DIR="/usr/share/applications"

echo ""
log_info "Exodus Linux Uninstaller"
log_info "========================"
echo ""

# ── Root check ─────────────────────────────────────────────────────────────
if [ "$EUID" -ne 0 ]; then
  error_exit "This uninstaller must be run as root (e.g. sudo $0)"
fi
log_ok "Running as root"

# ── Remove application files ───────────────────────────────────────────────
log_info "Removing application files..."

if [ -d "$OPT_DIR" ]; then
  rm -rf "$OPT_DIR"
  log_ok "Removed $OPT_DIR"
else
  log_warn "$OPT_DIR not found — skipping"
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

# ── Remove command-line symlinks ───────────────────────────────────────────
log_info "Removing command-line symlinks..."

for dir in /usr/local/bin /usr/bin /bin; do
  link="$dir/exodus"
  if [ -L "$link" ]; then
    rm -f "$link"
    log_ok "Removed symlink $link"
  fi
done

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
echo "  ${YELLOW}rm -rf ~/.config/Exodus ~/.local/share/Exodus ~/.cache/Exodus${NC}"
echo ""
