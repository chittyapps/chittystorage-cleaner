#!/bin/bash

##############################################
# Install Weekly Automated Cleanup for Mac
##############################################

echo "=========================================="
echo "  Weekly Cleanup Installer"
echo "=========================================="
echo ""

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Define installation paths
INSTALL_DIR="$HOME/.chittycleaner"
CLEANUP_SCRIPT="$INSTALL_DIR/weekly-cleanup.sh"
PLIST_FILE="$HOME/Library/LaunchAgents/com.chittycleaner.weekly.plist"
LOG_FILE="$HOME/.cleanup-log.txt"

echo "Installation will:"
echo "  • Install cleanup script to: $INSTALL_DIR"
echo "  • Schedule weekly runs every Sunday at 2 AM"
echo "  • Log results to: $LOG_FILE"
echo ""
read -p "Continue? (y/n): " confirm

if [ "$confirm" != "y" ]; then
    echo "Installation cancelled."
    exit 0
fi

echo ""
echo "Installing..."

# 1. Create installation directory
mkdir -p "$INSTALL_DIR"
mkdir -p "$HOME/Library/LaunchAgents"

# 2. Copy and setup cleanup script
echo "  → Installing cleanup script..."
cp "$SCRIPT_DIR/weekly-cleanup.sh" "$CLEANUP_SCRIPT"
chmod +x "$CLEANUP_SCRIPT"

# 3. Create plist file with correct path
echo "  → Creating schedule..."
cat > "$PLIST_FILE" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.chittycleaner.weekly</string>

    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>$CLEANUP_SCRIPT</string>
    </array>

    <key>StartCalendarInterval</key>
    <dict>
        <key>Weekday</key>
        <integer>0</integer>
        <!-- Sunday -->
        <key>Hour</key>
        <integer>2</integer>
        <!-- 2 AM -->
        <key>Minute</key>
        <integer>0</integer>
    </dict>

    <key>StandardOutPath</key>
    <string>/tmp/chittycleaner.out</string>

    <key>StandardErrorPath</key>
    <string>/tmp/chittycleaner.err</string>

    <key>RunAtLoad</key>
    <false/>

    <key>Nice</key>
    <integer>10</integer>
</dict>
</plist>
EOF

# 4. Load the schedule
echo "  → Activating schedule..."
launchctl unload "$PLIST_FILE" 2>/dev/null  # Unload if already exists
launchctl load "$PLIST_FILE"

# 5. Create initial log file
touch "$LOG_FILE"

echo ""
echo "=========================================="
echo "  ✅ Installation Complete!"
echo "=========================================="
echo ""
echo "Weekly cleanup is now scheduled for:"
echo "  • Every Sunday at 2:00 AM"
echo ""
echo "What gets cleaned automatically:"
echo "  ✓ CloudKit temporary files (>7 days)"
echo "  ✓ Claude logs (>30 days)"
echo "  ✓ Browser caches"
echo "  ✓ NPM cache"
echo "  ✓ Old downloads (>90 days)"
echo "  ✓ Old Messages videos (>180 days)"
echo "  ✓ Homebrew cache"
echo "  ✓ Xcode cache (>7 days)"
echo ""
echo "Useful commands:"
echo "  • View cleanup log:    cat $LOG_FILE"
echo "  • Run cleanup now:     $CLEANUP_SCRIPT"
echo "  • Uninstall:           launchctl unload $PLIST_FILE"
echo ""
echo "Test it now? (y/n): "
read test_now

if [ "$test_now" = "y" ]; then
    echo ""
    echo "Running cleanup now..."
    "$CLEANUP_SCRIPT"
    echo ""
    echo "Check the log:"
    tail -20 "$LOG_FILE"
fi

echo ""
echo "Done! Your Mac will now clean itself weekly."
echo ""
