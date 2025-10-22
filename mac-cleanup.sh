#!/bin/bash

##############################################
# Mac Disk Space Cleanup Script
# Safely removes temporary and cache files
##############################################

echo "=============================================="
echo "   Mac Disk Space Cleanup"
echo "=============================================="
echo ""

# Function to format bytes
format_bytes() {
    numfmt --to=iec-i --suffix=B $1 2>/dev/null || echo "$1 bytes"
}

# Function to get directory size
get_size() {
    du -sb "$1" 2>/dev/null | cut -f1
}

total_freed=0

echo "Analyzing disk usage before cleanup..."
df -h ~ | tail -1
echo ""

# 1. CloudKit Temporary Files (BIGGEST SAVING - ~50GB)
echo "=============================================="
echo "1. Cleaning CloudKit temporary files..."
echo "=============================================="
cloudkit_path="$HOME/Library/Caches/CloudKit/com.apple.bird"
if [ -d "$cloudkit_path" ]; then
    before=$(get_size "$cloudkit_path")
    echo "Before: $(format_bytes $before)"

    # Remove temporary MMCS files
    find "$cloudkit_path" -type f -name "tmpm-*" -delete 2>/dev/null

    after=$(get_size "$cloudkit_path")
    freed=$((before - after))
    total_freed=$((total_freed + freed))
    echo "Freed: $(format_bytes $freed)"
else
    echo "CloudKit cache not found - skipping"
fi
echo ""

# 2. Claude Logs
echo "=============================================="
echo "2. Cleaning Claude logs..."
echo "=============================================="
if [ -d "$HOME/.claude/logs" ]; then
    before=$(get_size "$HOME/.claude/logs")
    echo "Before: $(format_bytes $before)"

    rm -rf "$HOME/.claude/logs/GoogleDrive-"* 2>/dev/null

    after=$(get_size "$HOME/.claude/logs")
    freed=$((before - after))
    total_freed=$((total_freed + freed))
    echo "Freed: $(format_bytes $freed)"
else
    echo "Claude logs not found - skipping"
fi
echo ""

# 3. Claude Debug Files
echo "=============================================="
echo "3. Cleaning Claude debug files..."
echo "=============================================="
if [ -d "$HOME/.claude/debug" ]; then
    before=$(get_size "$HOME/.claude/debug")
    echo "Before: $(format_bytes $before)"

    rm -rf "$HOME/.claude/debug"/*.txt 2>/dev/null

    after=$(get_size "$HOME/.claude/debug")
    freed=$((before - after))
    total_freed=$((total_freed + freed))
    echo "Freed: $(format_bytes $freed)"
else
    echo "Claude debug not found - skipping"
fi
echo ""

# 4. Old Messages Videos (>90 days)
echo "=============================================="
echo "4. Cleaning old Messages videos (>90 days)..."
echo "=============================================="
if [ -d "$HOME/Library/Messages/Attachments" ]; then
    # Count and size before
    old_videos=$(find "$HOME/Library/Messages/Attachments" -name "*.MOV" -mtime +90 2>/dev/null)
    if [ -n "$old_videos" ]; then
        count=$(echo "$old_videos" | wc -l | tr -d ' ')
        echo "Found $count old videos"

        # Calculate size
        size=0
        while IFS= read -r file; do
            fsize=$(stat -f%z "$file" 2>/dev/null || echo 0)
            size=$((size + fsize))
        done <<< "$old_videos"

        echo "Total size: $(format_bytes $size)"
        read -p "Delete these old videos? (y/n): " confirm
        if [ "$confirm" = "y" ]; then
            find "$HOME/Library/Messages/Attachments" -name "*.MOV" -mtime +90 -delete 2>/dev/null
            total_freed=$((total_freed + size))
            echo "Freed: $(format_bytes $size)"
        else
            echo "Skipped"
        fi
    else
        echo "No old videos found"
    fi
else
    echo "Messages attachments not found - skipping"
fi
echo ""

# 5. Chittychat overlay state
echo "=============================================="
echo "5. Cleaning chittychat overlay state..."
echo "=============================================="
if [ -f "$HOME/.chittychat/native-overlay-state.json" ]; then
    size=$(stat -f%z "$HOME/.chittychat/native-overlay-state.json" 2>/dev/null || echo 0)
    echo "Size: $(format_bytes $size)"
    rm -f "$HOME/.chittychat/native-overlay-state.json" 2>/dev/null
    total_freed=$((total_freed + size))
    echo "Freed: $(format_bytes $size)"
else
    echo "Chittychat state not found - skipping"
fi
echo ""

# 6. Browser Caches
echo "=============================================="
echo "6. Cleaning browser caches..."
echo "=============================================="
# Chrome
if [ -d "$HOME/Library/Caches/Google/Chrome" ]; then
    before=$(get_size "$HOME/Library/Caches/Google/Chrome")
    echo "Chrome cache before: $(format_bytes $before)"
    rm -rf "$HOME/Library/Caches/Google/Chrome"/* 2>/dev/null
    after=$(get_size "$HOME/Library/Caches/Google/Chrome")
    freed=$((before - after))
    total_freed=$((total_freed + freed))
    echo "Chrome freed: $(format_bytes $freed)"
fi

# Safari
if [ -d "$HOME/Library/Caches/com.apple.Safari" ]; then
    before=$(get_size "$HOME/Library/Caches/com.apple.Safari")
    echo "Safari cache before: $(format_bytes $before)"
    rm -rf "$HOME/Library/Caches/com.apple.Safari"/* 2>/dev/null
    after=$(get_size "$HOME/Library/Caches/com.apple.Safari")
    freed=$((before - after))
    total_freed=$((total_freed + freed))
    echo "Safari freed: $(format_bytes $freed)"
fi
echo ""

# 7. System Caches
echo "=============================================="
echo "7. Cleaning user caches..."
echo "=============================================="
if [ -d "$HOME/Library/Caches" ]; then
    # Clean specific safe caches
    for cache_dir in "com.apple.bird" "CloudKit" "SiriTTS"; do
        if [ -d "$HOME/Library/Caches/$cache_dir" ]; then
            before=$(get_size "$HOME/Library/Caches/$cache_dir")
            rm -rf "$HOME/Library/Caches/$cache_dir"/* 2>/dev/null
            after=$(get_size "$HOME/Library/Caches/$cache_dir")
            freed=$((before - after))
            if [ $freed -gt 0 ]; then
                total_freed=$((total_freed + freed))
                echo "$cache_dir freed: $(format_bytes $freed)"
            fi
        fi
    done
fi
echo ""

# 8. Old downloads
echo "=============================================="
echo "8. Finding old downloads (>90 days)..."
echo "=============================================="
if [ -d "$HOME/Downloads" ]; then
    old_files=$(find "$HOME/Downloads" -type f -mtime +90 2>/dev/null | head -20)
    if [ -n "$old_files" ]; then
        echo "Found old downloads (showing first 20):"
        echo "$old_files"
        echo ""
        read -p "Review and delete manually? (y/n): " confirm
        if [ "$confirm" = "y" ]; then
            open "$HOME/Downloads"
        fi
    else
        echo "No old downloads found"
    fi
fi
echo ""

# Summary
echo "=============================================="
echo "   CLEANUP SUMMARY"
echo "=============================================="
echo "Total space freed: $(format_bytes $total_freed)"
echo ""
echo "Disk usage after cleanup:"
df -h ~ | tail -1
echo ""
echo "=============================================="
echo "Cleanup complete!"
echo "=============================================="
