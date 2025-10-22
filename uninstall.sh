#!/bin/bash

# Storage Management Daemon Uninstall Script

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Resolve repo directory (where this script resides)
DAEMON_DIR="$(cd "$(dirname "$0")" && pwd)"
LAUNCHD_PLIST="com.user.storage-daemon.plist"
LAUNCHD_PATH="$HOME/Library/LaunchAgents/$LAUNCHD_PLIST"

echo -e "${BLUE}=== Uninstalling Storage Management Daemon ===${NC}"

if launchctl list | grep -q "com.user.storage-daemon"; then
  echo -e "${YELLOW}Stopping launchd job...${NC}"
  launchctl unload "$LAUNCHD_PATH" 2>/dev/null || true
fi

if [ -f "$LAUNCHD_PATH" ]; then
  echo -e "${YELLOW}Removing LaunchAgents plist...${NC}"
  rm -f "$LAUNCHD_PATH"
fi

echo -e "${YELLOW}Removing symlink(s) if present...${NC}"
rm -f "/usr/local/bin/storage-daemon" 2>/dev/null || true
rm -f "$HOME/bin/storage-daemon" 2>/dev/null || true

echo -e "${GREEN}✓ Uninstall completed${NC}"
echo "Repository files remain at: $DAEMON_DIR"
echo "Delete the repo folder manually if desired."

