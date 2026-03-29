#!/bin/bash

# Скрипт для скачивания ffmpeg и ffprobe для Tauri sidecar
# Использование: ./scripts/download-ffmpeg.sh

set -e

BIN_DIR="src-tauri/bin"
mkdir -p "$BIN_DIR"

# Определяем архитектуру
ARCH=$(uname -m)
OS=$(uname -s)

echo "Detected: $OS $ARCH"

if [[ "$OS" == "Darwin" ]]; then
    if [[ "$ARCH" == "arm64" ]]; then
        TRIPLE="aarch64-apple-darwin"
    else
        TRIPLE="x86_64-apple-darwin"
    fi

    FFMPEG_URL="https://evermeet.cx/ffmpeg/getrelease/ffmpeg/zip"
    FFPROBE_URL="https://evermeet.cx/ffmpeg/getrelease/ffprobe/zip"

    echo "Downloading ffmpeg for macOS..."
    curl -L "$FFMPEG_URL" -o /tmp/ffmpeg.zip
    unzip -o /tmp/ffmpeg.zip -d /tmp/
    mv /tmp/ffmpeg "$BIN_DIR/ffmpeg-$TRIPLE"
    chmod +x "$BIN_DIR/ffmpeg-$TRIPLE"
    rm /tmp/ffmpeg.zip

    echo "Downloading ffprobe for macOS..."
    curl -L "$FFPROBE_URL" -o /tmp/ffprobe.zip
    unzip -o /tmp/ffprobe.zip -d /tmp/
    mv /tmp/ffprobe "$BIN_DIR/ffprobe-$TRIPLE"
    chmod +x "$BIN_DIR/ffprobe-$TRIPLE"
    rm /tmp/ffprobe.zip

    # Удаляем карантин на macOS
    xattr -cr "$BIN_DIR/ffmpeg-$TRIPLE" 2>/dev/null || true
    xattr -cr "$BIN_DIR/ffprobe-$TRIPLE" 2>/dev/null || true

    # Ad-hoc подпись для macOS
    codesign --force --deep -s - "$BIN_DIR/ffmpeg-$TRIPLE" 2>/dev/null || true
    codesign --force --deep -s - "$BIN_DIR/ffprobe-$TRIPLE" 2>/dev/null || true

elif [[ "$OS" == "Linux" ]]; then
    TRIPLE="x86_64-unknown-linux-gnu"

    # Используем статические билды от John Van Sickle
    FFMPEG_URL="https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz"

    echo "Downloading ffmpeg for Linux..."
    curl -L "$FFMPEG_URL" -o /tmp/ffmpeg.tar.xz
    tar -xf /tmp/ffmpeg.tar.xz -C /tmp/
    FFMPEG_DIR=$(ls -d /tmp/ffmpeg-*-amd64-static | head -1)
    mv "$FFMPEG_DIR/ffmpeg" "$BIN_DIR/ffmpeg-$TRIPLE"
    mv "$FFMPEG_DIR/ffprobe" "$BIN_DIR/ffprobe-$TRIPLE"
    chmod +x "$BIN_DIR/ffmpeg-$TRIPLE" "$BIN_DIR/ffprobe-$TRIPLE"
    rm -rf /tmp/ffmpeg.tar.xz "$FFMPEG_DIR"

else
    echo "Unsupported OS: $OS"
    echo "Please download ffmpeg manually and place in $BIN_DIR"
    exit 1
fi

echo ""
echo "Done! Downloaded:"
ls -la "$BIN_DIR/"
