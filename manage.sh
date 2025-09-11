#!/bin/bash

# Storage Daemon Management Script

DAEMON_DIR="$HOME/storage-daemon"
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
    *)
        echo "Usage: $0 {start|stop|restart|status|logs|dashboard|config}"
        exit 1
        ;;
esac
