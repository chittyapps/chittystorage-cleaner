#!/bin/bash

##############################################
# Weekly Automated Disk Cleanup for Mac
# Runs safely in background to prevent disk filling
##############################################

LOG_FILE="$HOME/.cleanup-log.txt"
DATE=$(date '+%Y-%m-%d %H:%M:%S')

echo "[$DATE] Starting weekly cleanup..." >> "$LOG_FILE"

total_freed=0

# Function to get directory size safely
get_size() {
    du -sk "$1" 2>/dev/null | cut -f1 || echo 0
}

# 1. CloudKit temporary files (biggest win)
if [ -d "$HOME/Library/Caches/CloudKit" ]; then
    before=$(get_size "$HOME/Library/Caches/CloudKit")
    find "$HOME/Library/Caches/CloudKit" -type f -name "tmpm-*" -mtime +7 -delete 2>/dev/null
    after=$(get_size "$HOME/Library/Caches/CloudKit")
    freed=$((before - after))
    total_freed=$((total_freed + freed))
    echo "  CloudKit cache: ${freed}KB freed" >> "$LOG_FILE"
fi

# 2. Claude logs older than 30 days
if [ -d "$HOME/.claude/logs" ]; then
    before=$(get_size "$HOME/.claude/logs")
    find "$HOME/.claude/logs" -type f -mtime +30 -delete 2>/dev/null
    after=$(get_size "$HOME/.claude/logs")
    freed=$((before - after))
    total_freed=$((total_freed + freed))
    echo "  Claude logs: ${freed}KB freed" >> "$LOG_FILE"
fi

# 3. Claude debug files older than 7 days
if [ -d "$HOME/.claude/debug" ]; then
    before=$(get_size "$HOME/.claude/debug")
    find "$HOME/.claude/debug" -type f -mtime +7 -delete 2>/dev/null
    after=$(get_size "$HOME/.claude/debug")
    freed=$((before - after))
    total_freed=$((total_freed + freed))
    echo "  Claude debug: ${freed}KB freed" >> "$LOG_FILE"
fi

# 4. Old Downloads (>90 days)
if [ -d "$HOME/Downloads" ]; then
    before=$(get_size "$HOME/Downloads")
    find "$HOME/Downloads" -type f -mtime +90 -delete 2>/dev/null
    after=$(get_size "$HOME/Downloads")
    freed=$((before - after))
    total_freed=$((total_freed + freed))
    echo "  Old downloads: ${freed}KB freed" >> "$LOG_FILE"
fi

# 5. Browser caches
for cache in "Google/Chrome/Default/Cache" "com.apple.Safari" "Firefox/Profiles/*/cache2"; do
    cache_path="$HOME/Library/Caches/$cache"
    if [ -d "$cache_path" ]; then
        before=$(get_size "$cache_path")
        rm -rf "$cache_path"/* 2>/dev/null
        after=$(get_size "$cache_path")
        freed=$((before - after))
        total_freed=$((total_freed + freed))
    fi
done
echo "  Browser caches: cleaned" >> "$LOG_FILE"

# 6. NPM cache
if [ -d "$HOME/.npm/_cacache" ]; then
    before=$(get_size "$HOME/.npm/_cacache")
    rm -rf "$HOME/.npm/_cacache"/* 2>/dev/null
    after=$(get_size "$HOME/.npm/_cacache")
    freed=$((before - after))
    total_freed=$((total_freed + freed))
    echo "  NPM cache: ${freed}KB freed" >> "$LOG_FILE"
fi

# 7. Homebrew cache (if exists)
if command -v brew >/dev/null 2>&1; then
    brew cleanup -s >/dev/null 2>&1
    echo "  Homebrew: cleaned" >> "$LOG_FILE"
fi

# 8. Xcode derived data (if exists)
if [ -d "$HOME/Library/Developer/Xcode/DerivedData" ]; then
    # Keep only last 7 days
    find "$HOME/Library/Developer/Xcode/DerivedData" -type d -maxdepth 1 -mtime +7 -exec rm -rf {} \; 2>/dev/null
    echo "  Xcode cache: cleaned" >> "$LOG_FILE"
fi

# 9. System temporary files
if [ -d "$HOME/Library/Caches" ]; then
    find "$HOME/Library/Caches" -type f -name "*.tmp" -mtime +7 -delete 2>/dev/null
fi

# 10. Messages attachments (only very old ones - 180 days)
if [ -d "$HOME/Library/Messages/Attachments" ]; then
    before=$(get_size "$HOME/Library/Messages/Attachments")
    find "$HOME/Library/Messages/Attachments" -name "*.MOV" -mtime +180 -delete 2>/dev/null
    find "$HOME/Library/Messages/Attachments" -name "*.mp4" -mtime +180 -delete 2>/dev/null
    after=$(get_size "$HOME/Library/Messages/Attachments")
    freed=$((before - after))
    total_freed=$((total_freed + freed))
    echo "  Old Messages videos (>6mo): ${freed}KB freed" >> "$LOG_FILE"
fi

# Convert KB to human readable
total_mb=$((total_freed / 1024))
total_gb=$((total_mb / 1024))

if [ $total_gb -gt 0 ]; then
    echo "  TOTAL FREED: ${total_gb}GB" >> "$LOG_FILE"
elif [ $total_mb -gt 0 ]; then
    echo "  TOTAL FREED: ${total_mb}MB" >> "$LOG_FILE"
else
    echo "  TOTAL FREED: ${total_freed}KB" >> "$LOG_FILE"
fi

# Get current disk usage
disk_usage=$(df -h ~ | tail -1 | awk '{print $5}')
disk_avail=$(df -h ~ | tail -1 | awk '{print $4}')
echo "  Disk usage: $disk_usage (${disk_avail} available)" >> "$LOG_FILE"

# Alert if still getting full (>85%)
usage_percent=$(echo $disk_usage | sed 's/%//')
if [ "$usage_percent" -gt 85 ]; then
    echo "  ⚠️  WARNING: Disk still >85% full!" >> "$LOG_FILE"
    # You could add a notification here with osascript if desired
fi

echo "[$DATE] Weekly cleanup complete." >> "$LOG_FILE"
echo "" >> "$LOG_FILE"

exit 0
