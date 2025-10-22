#!/bin/bash

# Storage Management Daemon Installation Script

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Resolve to repository directory (directory containing this script)
DAEMON_DIR="$(cd "$(dirname "$0")" && pwd)"
LAUNCHD_PLIST="com.user.storage-daemon.plist"
LAUNCHD_PATH="$HOME/Library/LaunchAgents/$LAUNCHD_PLIST"
NODE_PATH="/usr/local/bin/node"

echo -e "${BLUE}=== Storage Management Daemon Installer ===${NC}"
echo ""

# Check prerequisites
check_prerequisites() {
    echo -e "${YELLOW}Checking prerequisites...${NC}"
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        echo -e "${RED}Node.js is not installed${NC}"
        echo "Installing Node.js via Homebrew..."
        
        if ! command -v brew &> /dev/null; then
            echo -e "${RED}Homebrew is not installed. Please install Homebrew first.${NC}"
            exit 1
        fi
        
        brew install node
    fi
    
    NODE_PATH=$(which node)
    echo -e "${GREEN}✓ Node.js found at: $NODE_PATH${NC}"
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        echo -e "${RED}npm is not installed${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✓ npm found${NC}"
}

# Install dependencies
install_dependencies() {
    echo -e "\n${YELLOW}Installing Node.js dependencies...${NC}"
    cd "$DAEMON_DIR"
    
    # Install dependencies
    npm install
    
    # Install PM2 globally for process management
    if ! command -v pm2 &> /dev/null; then
        echo "Installing PM2 globally..."
        npm install -g pm2
    fi
    
    echo -e "${GREEN}✓ Dependencies installed${NC}"
}

# Create launchd plist
create_launchd_plist() {
    echo -e "\n${YELLOW}Creating launchd configuration...${NC}"
    
    cat > "$LAUNCHD_PATH" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.user.storage-daemon</string>
    
    <key>ProgramArguments</key>
    <array>
        <string>$NODE_PATH</string>
        <string>$DAEMON_DIR/src/daemon.js</string>
    </array>
    
    <key>WorkingDirectory</key>
    <string>$DAEMON_DIR</string>
    
    <key>RunAtLoad</key>
    <true/>
    
    <key>KeepAlive</key>
    <dict>
        <key>SuccessfulExit</key>
        <false/>
        <key>Crashed</key>
        <true/>
    </dict>
    
    <key>StandardOutPath</key>
    <string>$DAEMON_DIR/logs/daemon.out.log</string>
    
    <key>StandardErrorPath</key>
    <string>$DAEMON_DIR/logs/daemon.error.log</string>
    
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
        <key>HOME</key>
        <string>$HOME</string>
        <key>NODE_ENV</key>
        <string>production</string>
    </dict>
    
    <key>ThrottleInterval</key>
    <integer>30</integer>
    
    <key>SoftResourceLimits</key>
    <dict>
        <key>NumberOfFiles</key>
        <integer>4096</integer>
    </dict>
</dict>
</plist>
EOF
    
    echo -e "${GREEN}✓ Launchd plist created${NC}"
}

# Create necessary directories
create_directories() {
    echo -e "\n${YELLOW}Creating directories...${NC}"
    
    mkdir -p "$DAEMON_DIR/logs"
    mkdir -p "$DAEMON_DIR/data"
    mkdir -p "$DAEMON_DIR/config"
    mkdir -p "$HOME/organized"
    
    echo -e "${GREEN}✓ Directories created${NC}"
}

# Start the daemon
start_daemon() {
    echo -e "\n${YELLOW}Starting the daemon...${NC}"
    
    # Unload if already loaded
    launchctl unload "$LAUNCHD_PATH" 2>/dev/null || true
    
    # Load the daemon
    launchctl load "$LAUNCHD_PATH"
    
    # Check if running
    sleep 2
    if launchctl list | grep -q "com.user.storage-daemon"; then
        echo -e "${GREEN}✓ Daemon started successfully${NC}"
    else
        echo -e "${RED}✗ Failed to start daemon${NC}"
        echo "Check logs at: $DAEMON_DIR/logs/"
        exit 1
    fi
}

# Create management script
create_management_script() {
    echo -e "\n${YELLOW}Creating management script...${NC}"

    # If a manage.sh already exists (from repo), keep it
    if [ -f "$DAEMON_DIR/manage.sh" ]; then
        chmod +x "$DAEMON_DIR/manage.sh"
    else
        cat > "$DAEMON_DIR/manage.sh" << EOF
#!/bin/bash

# Storage Daemon Management Script

DAEMON_DIR="$DAEMON_DIR"
LAUNCHD_LABEL="com.user.storage-daemon"
DASHBOARD_URL="http://localhost:3456"

case "\$1" in
    start)
        echo "Starting Storage Daemon..."
        launchctl load "\$HOME/Library/LaunchAgents/\$LAUNCHD_LABEL.plist" 2>/dev/null || echo "Already running"
        ;;
    stop)
        echo "Stopping Storage Daemon..."
        launchctl unload "\$HOME/Library/LaunchAgents/\$LAUNCHD_LABEL.plist"
        ;;
    restart)
        echo "Restarting Storage Daemon..."
        launchctl unload "\$HOME/Library/LaunchAgents/\$LAUNCHD_LABEL.plist" 2>/dev/null || true
        sleep 1
        launchctl load "\$HOME/Library/LaunchAgents/\$LAUNCHD_LABEL.plist"
        ;;
    status)
        if launchctl list | grep -q "\$LAUNCHD_LABEL"; then
            echo "✓ Daemon is running"
            echo "Dashboard: \$DASHBOARD_URL"
        else
            echo "✗ Daemon is not running"
        fi
        ;;
    logs)
        tail -f "\$DAEMON_DIR/logs/daemon.log"
        ;;
    dashboard)
        open "\$DASHBOARD_URL"
        ;;
    config)
        node "\$DAEMON_DIR/src/interactive-config.js"
        ;;
    *)
        echo "Usage: \$0 {start|stop|restart|status|logs|dashboard|config}"
        exit 1
        ;;
esac
EOF
        chmod +x "$DAEMON_DIR/manage.sh"
    fi

    # Create symlink for easy access
    ln -sf "$DAEMON_DIR/manage.sh" "/usr/local/bin/storage-daemon" 2>/dev/null || \
    ln -sf "$DAEMON_DIR/manage.sh" "$HOME/bin/storage-daemon" 2>/dev/null || true

    echo -e "${GREEN}✓ Management script created${NC}"
}

# Main installation
main() {
    echo -e "${BLUE}Installing Storage Management Daemon...${NC}"
    
    check_prerequisites
    create_directories
    install_dependencies
    create_launchd_plist
    create_management_script
    start_daemon
    
    echo ""
    echo -e "${GREEN}=== Installation Complete ===${NC}"
    echo ""
    echo "The Storage Management Daemon is now running!"
    echo ""
    echo -e "${BLUE}Dashboard:${NC} http://localhost:3456"
    echo ""
    echo -e "${BLUE}Management Commands:${NC}"
    echo "  storage-daemon start    - Start the daemon"
    echo "  storage-daemon stop     - Stop the daemon"
    echo "  storage-daemon restart  - Restart the daemon"
    echo "  storage-daemon status   - Check daemon status"
    echo "  storage-daemon logs     - View daemon logs"
    echo "  storage-daemon dashboard - Open web dashboard"
    echo "  storage-daemon config   - Edit configuration"
    echo ""
    echo -e "${BLUE}Or use the manage script directly:${NC}"
    echo "  $DAEMON_DIR/manage.sh"
    echo ""
    echo -e "${YELLOW}Opening dashboard...${NC}"
    sleep 3
    open "http://localhost:3456" 2>/dev/null || echo "Open http://localhost:3456 in your browser"
}

# Run installation
main "$@"
