#!/bin/bash

# Pre-commit хук
# Запускает проверки только для изменённого кода

set -e

echo "🔍 Pre-commit проверки..."

# Получаем список изменённых файлов (staged)
CHANGED_FILES=$(git diff --cached --name-only)
if [ -z "$CHANGED_FILES" ]; then
    echo "Нет изменений для коммита"
    exit 0
fi

# Проверяем Rust код
RUST_CHANGED=$(echo "$CHANGED_FILES" | grep -E "^src-tauri/|^plugins-legacy/" || echo "")
if [ -n "$RUST_CHANGED" ]; then
    echo "🦀 Проверка Rust кода..."
    cd src-tauri
    cargo fmt -- --check
    cargo check --quiet
    cargo test --quiet
    cargo clippy --quiet -- -D warnings
    cd ..
    echo "✅ Rust проверки пройдены"
else
    echo "⏭️ Rust код не менялся — проверки пропущены"
fi

# Проверяем TS/JS код
TS_CHANGED=$(echo "$CHANGED_FILES" | grep -E "\.(ts|tsx|js|jsx|vue)$" || echo "")
if [ -n "$TS_CHANGED" ]; then
    echo "🔷 Проверка TypeScript..."
    bun run lint
    echo "✅ TypeScript проверки пройдены"
else
    echo "⏭️ TS/JS код не менялся — проверки пропущены"
fi

echo ""
echo "✅ Все проверки пройдены"
