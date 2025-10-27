#!/bin/bash

##############################################
# Install Auto Disk Cleanup Monitor for Mac
# Monitors disk space and auto-cleans when full
##############################################

echo "=========================================="
echo "  Auto Cleanup Installer"
echo "=========================================="
echo ""

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Define installation paths
INSTALL_DIR="$HOME/.chittycleaner"
MONITOR_SCRIPT="$INSTALL_DIR/auto-cleanup-monitor.sh"
PLIST_FILE="$HOME/Library/LaunchAgents/com.chittycleaner.auto.plist"
LOG_FILE="$HOME/.cleanup-log.txt"

echo "This will install automatic disk cleanup that:"
echo "  • Monitors disk space every hour"
echo "  • Auto-cleans when disk is >80% full"
echo "  • Shows native Mac notifications"
echo "  • Runs silently in the background"
echo ""
echo "What gets cleaned automatically:"
echo "  ✓ CloudKit temp files (50+ GB possible)"
echo "  ✓ Browser caches"
echo "  ✓ Claude logs"
echo "  ✓ NPM cache"
echo "  ✓ Homebrew cache"
echo "  ✓ Xcode cache"
echo ""
read -p "Install? (y/n): " confirm

if [ "$confirm" != "y" ]; then
    echo "Installation cancelled."
    exit 0
fi

echo ""
echo "Installing..."

# 1. Create installation directory
mkdir -p "$INSTALL_DIR"
mkdir -p "$HOME/Library/LaunchAgents"

# 2. Copy and setup monitor script
echo "  → Installing monitor script..."
cp "$SCRIPT_DIR/auto-cleanup-monitor.sh" "$MONITOR_SCRIPT"
chmod +x "$MONITOR_SCRIPT"

# 3. Create plist to run every hour
echo "  → Creating hourly schedule..."
cat > "$PLIST_FILE" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.chittycleaner.auto</string>

    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>$MONITOR_SCRIPT</string>
    </array>

    <key>StartInterval</key>
    <integer>3600</integer>
    <!-- Check every hour (3600 seconds) -->

    <key>RunAtLoad</key>
    <true/>
    <!-- Run immediately when loaded -->

    <key>StandardOutPath</key>
    <string>/tmp/chittycleaner-auto.out</string>

    <key>StandardErrorPath</key>
    <string>/tmp/chittycleaner-auto.err</string>

    <key>Nice</key>
    <integer>10</integer>
    <!-- Low priority -->

    <key>ProcessType</key>
    <string>Background</string>
</dict>
</plist>
EOF

# 4. Load the schedule
echo "  → Activating monitor..."
launchctl unload "$PLIST_FILE" 2>/dev/null  # Unload if already exists
launchctl load "$PLIST_FILE"

# 5. Create initial log file
touch "$LOG_FILE"

echo ""
echo "=========================================="
echo "  ✅ Installation Complete!"
echo "=========================================="
echo ""
echo "Auto cleanup is now active!"
echo ""
echo "How it works:"
echo "  • Checks disk space every hour"
echo "  • When >80% full → auto cleanup"
echo "  • When >90% full → urgent cleanup"
echo "  • Shows native Mac notifications"
echo ""
echo "Useful commands:"
echo "  • View log:         tail -f $LOG_FILE"
echo "  • Run check now:    $MONITOR_SCRIPT"
echo "  • Uninstall:        launchctl unload $PLIST_FILE"
echo "  • Stop monitoring:  launchctl stop com.chittycleaner.auto"
echo "  • Start monitoring: launchctl start com.chittycleaner.auto"
echo ""

# Ask if they want to test it now
echo "Your disk is currently:"
df -h ~ | tail -1 | awk '{print "  " $5 " full (" $4 " available)"}'
echo ""
read -p "Run first check now? (y/n): " test_now

if [ "$test_now" = "y" ]; then
    echo ""
    echo "Running first check..."
    "$MONITOR_SCRIPT"
    echo ""
    echo "Check the log:"
    tail -10 "$LOG_FILE"
fi

echo ""
echo "=========================================="
echo "Done! Your Mac will now monitor itself."
echo "=========================================="
echo ""
