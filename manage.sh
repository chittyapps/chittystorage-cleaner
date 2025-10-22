#!/bin/bash

# Storage Daemon Management Script

# Resolve to the directory where this script lives
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DAEMON_DIR="$SCRIPT_DIR"
LAUNCHD_LABEL="com.user.storage-daemon"
DASHBOARD_URL="http://localhost:3456"

case "$1" in
    start)
        echo "Starting Storage Daemon..."
        launchctl load "$HOME/Library/LaunchAgents/$LAUNCHD_LABEL.plist" 2>/dev/null || echo "Already running"
        ;;
    stop)
        echo "Stopping Storage Daemon..."
        launchctl unload "$HOME/Library/LaunchAgents/$LAUNCHD_LABEL.plist"
        ;;
    restart)
        echo "Restarting Storage Daemon..."
        launchctl unload "$HOME/Library/LaunchAgents/$LAUNCHD_LABEL.plist" 2>/dev/null || true
        sleep 1
        launchctl load "$HOME/Library/LaunchAgents/$LAUNCHD_LABEL.plist"
        ;;
    status)
        if launchctl list | grep -q "$LAUNCHD_LABEL"; then
            echo "✓ Daemon is running"
            echo "Dashboard: $DASHBOARD_URL"
        else
            echo "✗ Daemon is not running"
        fi
        ;;
    logs)
        tail -f "$DAEMON_DIR/logs/daemon.log"
        ;;
    backup)
        if [ "$2" = "--dry-run" ] || [ "$2" = "-n" ]; then
            node "$DAEMON_DIR/src/backup-cli.js" --dry-run
        else
            node "$DAEMON_DIR/src/backup-cli.js"
        fi
        ;;
    alerts-test)
        curl -s -X POST http://localhost:3456/api/alerts/test && echo "\nTriggered alerts test"
        ;;
    snapshot)
        curl -s -X POST http://localhost:3456/api/snapshot && echo "\nSnapshot triggered"
        ;;
    digest)
        curl -s -X POST http://localhost:3456/api/digest/run && echo "\nDigest triggered"
        ;;
    dashboard)
        open "$DASHBOARD_URL"
        ;;
    config)
        echo "Configuration options:"
        echo "1. Interactive config (recommended)"
        echo "2. Edit config file directly"
        read -p "Choose option [1]: " config_choice
        if [ "${config_choice:-1}" = "2" ]; then
            ${EDITOR:-nano} "$DAEMON_DIR/config/daemon.config.json"
        else
            node "$DAEMON_DIR/src/interactive-config.js"
        fi
        ;;
    uninstall)
        bash "$DAEMON_DIR/uninstall.sh"
        ;;
    notion-setup)
        if [ -z "$NOTION_API_KEY" ] || [ -z "$NOTION_PARENT_PAGE_ID" ]; then
            echo "Set NOTION_API_KEY and NOTION_PARENT_PAGE_ID env vars first."
            exit 1
        fi
        node "$DAEMON_DIR/scripts/notion-setup.js"
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|logs|backup [--dry-run]|dashboard|config|snapshot|digest|alerts-test|notion-setup|uninstall}"
        exit 1
        ;;
esac
