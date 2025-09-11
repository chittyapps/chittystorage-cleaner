#!/bin/bash

# Remote Deployment Script for Storage Daemon

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

REMOTE_HOST="$1"
REMOTE_USER="$2"

if [[ -z "$REMOTE_HOST" || -z "$REMOTE_USER" ]]; then
    echo "Usage: $0 <remote-host> <remote-user>"
    echo "Example: $0 192.168.1.100 john"
    exit 1
fi

echo -e "${BLUE}=== Remote Storage Daemon Deployment ===${NC}"
echo "Target: $REMOTE_USER@$REMOTE_HOST"

# Create deployment package
echo -e "\n${YELLOW}Creating deployment package...${NC}"
cd ~/storage-daemon
tar -czf ../storage-daemon-deploy.tar.gz .

# Copy to remote machine
echo -e "\n${YELLOW}Copying to remote machine...${NC}"
scp ../storage-daemon-deploy.tar.gz "$REMOTE_USER@$REMOTE_HOST:~/"

# Deploy on remote machine
echo -e "\n${YELLOW}Installing on remote machine...${NC}"
ssh "$REMOTE_USER@$REMOTE_HOST" << 'EOF'
    # Extract
    tar -xzf storage-daemon-deploy.tar.gz -C ~/storage-daemon/
    cd ~/storage-daemon
    
    # Make executable
    chmod +x install.sh
    
    # Install (will auto-detect paths for this user)
    ./install.sh
    
    echo "✅ Installation complete!"
    echo "Dashboard: http://$(hostname -I | cut -d' ' -f1):3456"
EOF

# Cleanup
rm ../storage-daemon-deploy.tar.gz

echo -e "\n${GREEN}=== Remote Deployment Complete ===${NC}"
echo "The daemon is now running on $REMOTE_HOST"
echo "Access dashboard at: http://$REMOTE_HOST:3456"