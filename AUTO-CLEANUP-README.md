# Automatic Disk Cleanup for Mac

Two cleanup options available:

## Option 1: Auto-Monitor (RECOMMENDED) 🎯

**Automatically cleans when disk gets full**

```bash
./install-auto-cleanup.sh
```

### How it works:
- Monitors disk space **every hour**
- When disk is **>80% full** → auto cleanup
- When disk is **>90% full** → urgent cleanup
- Shows **native Mac notifications**
- Runs silently in background

### What gets cleaned:
✓ CloudKit temp files (50+ GB possible)
✓ Browser caches (Chrome, Safari, Firefox)
✓ Claude logs & debug files
✓ NPM cache
✓ Homebrew cache
✓ Xcode derived data
✓ Temporary files

---

## Option 2: Weekly Schedule

**Runs cleanup every Sunday at 2 AM**

```bash
./install-weekly-cleanup.sh
```

Cleans the same items but on a fixed schedule instead of monitoring disk usage.

---

## Manual Cleanup

**Run cleanup anytime:**
```bash
./mac-cleanup.sh
```

**Or on Linux/in container:**
```bash
node bin/storage-daemon.js cleanup
```

---

## Commands

### After Installation:

**View cleanup log:**
```bash
tail -f ~/.cleanup-log.txt
```

**Check disk usage:**
```bash
df -h ~
```

**Run monitor now:**
```bash
~/.chittycleaner/auto-cleanup-monitor.sh
```

**Uninstall auto-cleanup:**
```bash
launchctl unload ~/Library/LaunchAgents/com.chittycleaner.auto.plist
rm ~/Library/LaunchAgents/com.chittycleaner.auto.plist
rm -rf ~/.chittycleaner
```

**Uninstall weekly cleanup:**
```bash
launchctl unload ~/Library/LaunchAgents/com.chittycleaner.weekly.plist
rm ~/Library/LaunchAgents/com.chittycleaner.weekly.plist
```

---

## Notifications

You'll see Mac notifications when:
- Disk is >80% full (cleanup starting)
- Disk is >90% full (urgent warning)
- Cleanup completes (shows space freed)

---

## Customization

Edit thresholds in `auto-cleanup-monitor.sh`:
```bash
THRESHOLD=80  # Run cleanup when >80% full
CRITICAL=90   # Show warning when >90% full
```

Change check frequency in `~/Library/LaunchAgents/com.chittycleaner.auto.plist`:
```xml
<key>StartInterval</key>
<integer>3600</integer>  <!-- 3600 = 1 hour -->
```

---

## Your Recent Cleanup Results

**Before:** 191 GB used, 281 MB free (100% FULL!)
**After:** 94 GB used, 97 GB free (50% capacity)
**Total freed:** 97 GB! 🎉

With auto-cleanup installed, this won't happen again!
