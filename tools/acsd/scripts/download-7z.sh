#!/bin/bash

# Скрипт для скачивания 7z для Tauri sidecar
# Использование: ./scripts/download-7z.sh

set -e

BIN_DIR="src-tauri/bin"
mkdir -p "$BIN_DIR"

# Определяем архитектуру
ARCH=$(uname -m)
OS=$(uname -s)

echo "Detected: $OS $ARCH"

# Версия 7-Zip
VERSION="2408"

if [[ "$OS" == "Darwin" ]]; then
    if [[ "$ARCH" == "arm64" ]]; then
        TRIPLE="aarch64-apple-darwin"
    else
        TRIPLE="x86_64-apple-darwin"
    fi

    # Проверяем, существует ли уже файл
    if [[ -f "$BIN_DIR/7z-$TRIPLE" ]]; then
        echo "7z already exists at $BIN_DIR/7z-$TRIPLE"
        echo "Use --force to re-download"
        if [[ "$1" != "--force" ]]; then
            exit 0
        fi
    fi

    # macOS universal binary
    SEVENZIP_URL="https://7-zip.org/a/7z${VERSION}-mac.tar.xz"

    echo "Downloading 7z for macOS..."
    curl -L "$SEVENZIP_URL" -o /tmp/7z-mac.tar.xz
    mkdir -p /tmp/7z-mac
    tar -xf /tmp/7z-mac.tar.xz -C /tmp/7z-mac

    # 7zz - это консольная версия
    mv /tmp/7z-mac/7zz "$BIN_DIR/7z-$TRIPLE"
    chmod +x "$BIN_DIR/7z-$TRIPLE"
    rm -rf /tmp/7z-mac.tar.xz /tmp/7z-mac

    # Удаляем карантин на macOS
    xattr -cr "$BIN_DIR/7z-$TRIPLE" 2>/dev/null || true

    # Ad-hoc подпись для macOS
    codesign --force --deep -s - "$BIN_DIR/7z-$TRIPLE" 2>/dev/null || true

elif [[ "$OS" == "Linux" ]]; then
    TRIPLE="x86_64-unknown-linux-gnu"

    # Проверяем, существует ли уже файл
    if [[ -f "$BIN_DIR/7z-$TRIPLE" ]]; then
        echo "7z already exists at $BIN_DIR/7z-$TRIPLE"
        echo "Use --force to re-download"
        if [[ "$1" != "--force" ]]; then
            exit 0
        fi
    fi

    SEVENZIP_URL="https://7-zip.org/a/7z${VERSION}-linux-x64.tar.xz"

    echo "Downloading 7z for Linux..."
    curl -L "$SEVENZIP_URL" -o /tmp/7z-linux.tar.xz
    mkdir -p /tmp/7z-linux
    tar -xf /tmp/7z-linux.tar.xz -C /tmp/7z-linux
    mv /tmp/7z-linux/7zz "$BIN_DIR/7z-$TRIPLE"
    chmod +x "$BIN_DIR/7z-$TRIPLE"
    rm -rf /tmp/7z-linux.tar.xz /tmp/7z-linux

else
    echo "Unsupported OS: $OS"
    echo "Please download 7z manually and place in $BIN_DIR"
    exit 1
fi

echo ""
echo "Done! Downloaded:"
ls -la "$BIN_DIR/7z-"*
