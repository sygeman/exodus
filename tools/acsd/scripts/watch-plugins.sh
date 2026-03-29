#!/bin/bash

# Watch script for Edem Tauri plugins
# Usage: ./watch-plugins.sh [plugin-name]

set -e

PLUGIN_DIR="${1:-all}"

if [ "$PLUGIN_DIR" = "all" ]; then
  echo "Watching all core plugins..."
  
  # Watch tasks plugin
  cargo watch \
    -w core/tauri-plugin-tasks/src \
    -x "build -p tauri-plugin-tasks" \
    &
  
  # Watch flows plugin  
  cargo watch \
    -w core/tauri-plugin-flows/src \
    -x "build -p tauri-plugin-flows" \
    &
    
  # Watch data plugin
  cargo watch \
    -w core/tauri-plugin-data/src \
    -x "build -p tauri-plugin-data" \
    &
    
  # Watch events plugin
  cargo watch \
    -w core/tauri-plugin-events/src \
    -x "build -p tauri-plugin-events" \
    &
    
  # Watch runners plugin
  cargo watch \
    -w core/tauri-plugin-runners/src \
    -x "build -p tauri-plugin-runners" \
    &
    
  # Watch notifications plugin
  cargo watch \
    -w core/tauri-plugin-notifications/src \
    -x "build -p tauri-plugin-notifications" \
    &
    
  # Watch metrics plugin
  cargo watch \
    -w core/tauri-plugin-metrics/src \
    -x "build -p tauri-plugin-metrics" \
    &
    
  # Watch settings plugin
  cargo watch \
    -w core/tauri-plugin-settings/src \
    -x "build -p tauri-plugin-settings" \
    &
    
  # Watch UI plugin
  cargo watch \
    -w core/tauri-plugin-ui/src \
    -x "build -p tauri-plugin-ui" \
    &
    
  # Watch MCP plugin
  cargo watch \
    -w core/tauri-plugin-mcp/src \
    -x "build -p tauri-plugin-mcp" \
    &
    
  # Watch devtools plugin
  cargo watch \
    -w core/tauri-plugin-devtools/src \
    -x "build -p tauri-plugin-devtools" \
    &
  
  echo "All plugin watchers started!"
  echo "Press Ctrl+C to stop all watchers"
  wait
else
  echo "Watching plugin: $PLUGIN_DIR"
  cargo watch \
    -w "core/tauri-plugin-$PLUGIN_DIR/src" \
    -x "build -p tauri-plugin-$PLUGIN_DIR"
fi