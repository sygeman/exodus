#!/bin/bash

# Скрипт для обновления версии приложения
# Использование: ./scripts/bump-version.sh [major|minor|patch]

set -e

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PACKAGE_JSON="$ROOT_DIR/package.json"
CARGO_TOML="$ROOT_DIR/src-tauri/Cargo.toml"
TAURI_CONF="$ROOT_DIR/src-tauri/tauri.conf.json"
DOWNLOADS_PLUGIN_TOML="$ROOT_DIR/plugins-legacy/tauri-plugin-downloads/Cargo.toml"

# Получаем текущую версию из package.json
CURRENT_VERSION=$(grep -o '"version": "[^"]*"' "$PACKAGE_JSON" | head -1 | cut -d'"' -f4)

if [ -z "$CURRENT_VERSION" ]; then
    echo "Ошибка: не удалось определить текущую версию"
    exit 1
fi

# Разбираем версию на части
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"

# Определяем тип обновления
BUMP_TYPE="${1:-patch}"

case "$BUMP_TYPE" in
    major)
        MAJOR=$((MAJOR + 1))
        MINOR=0
        PATCH=0
        ;;
    minor)
        MINOR=$((MINOR + 1))
        PATCH=0
        ;;
    patch)
        PATCH=$((PATCH + 1))
        ;;
    *)
        echo "Использование: $0 [major|minor|patch]"
        echo "  major - breaking changes (X.0.0)"
        echo "  minor - новый функционал (0.X.0)"
        echo "  patch - баг-фиксы (0.0.X)"
        exit 1
        ;;
esac

NEW_VERSION="$MAJOR.$MINOR.$PATCH"

echo "Обновление версии: $CURRENT_VERSION → $NEW_VERSION"

# Обновляем package.json
sed -i '' "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/" "$PACKAGE_JSON"
echo "✓ package.json"

# Обновляем Cargo.toml (только version в секции [package])
awk -v old="$CURRENT_VERSION" -v new="$NEW_VERSION" '
    /^\[package\]/ { in_package=1 }
    /^\[/ && !/^\[package\]/ { in_package=0 }
    in_package && /^version = / { sub(old, new) }
    { print }
' "$CARGO_TOML" > "$CARGO_TOML.tmp" && mv "$CARGO_TOML.tmp" "$CARGO_TOML"
echo "✓ src-tauri/Cargo.toml"

# Обновляем tauri.conf.json
sed -i '' "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/" "$TAURI_CONF"
echo "✓ src-tauri/tauri.conf.json"

# Обновляем версии всех плагинов
for PLUGIN_TOML in "$ROOT_DIR"/plugins-legacy/*/Cargo.toml; do
    if [ -f "$PLUGIN_TOML" ]; then
        PLUGIN_NAME=$(basename "$(dirname "$PLUGIN_TOML")")
        PLUGIN_VERSION=$(grep -m1 '^version = ' "$PLUGIN_TOML" | sed 's/version = "\(.*\)"/\1/')
        if [ -n "$PLUGIN_VERSION" ]; then
            sed -i '' "s/^version = \"$PLUGIN_VERSION\"/version = \"$NEW_VERSION\"/" "$PLUGIN_TOML"
            echo "✓ plugins-legacy/$PLUGIN_NAME/Cargo.toml"
        fi
    fi
done

# Обновляем Cargo.lock
echo "Обновление Cargo.lock..."
cd "$ROOT_DIR/src-tauri" && cargo check --quiet 2>/dev/null
echo "✓ src-tauri/Cargo.lock"

echo ""
echo "Версия обновлена до $NEW_VERSION"
