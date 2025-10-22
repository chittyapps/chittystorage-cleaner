#!/usr/bin/env node

/**
 * Storage Cleanup Script
 * Runs cleanup operations to free disk space
 */

const path = require('path');
const fs = require('fs').promises;
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

class CleanupTool {
    constructor() {
        this.totalFreed = 0;
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
    }

    async getDiskUsage() {
        try {
            const result = await execAsync('df -h / | tail -1');
            const parts = result.stdout.trim().split(/\s+/);

            return {
                total: parts[1],
                used: parts[2],
                available: parts[3],
                usePercent: parts[4],
                mount: parts[5] || '/'
            };
        } catch (err) {
            console.error('Error getting disk usage:', err.message);
            return null;
        }
    }

    async getDirectorySize(dirPath) {
        try {
            const result = await execAsync(`du -sb "${dirPath}" 2>/dev/null | cut -f1`);
            return parseInt(result.stdout.trim()) || 0;
        } catch (err) {
            return 0;
        }
    }

    async cleanCaches() {
        console.log('\nCleaning cache directories...');

        const cacheDirectories = [
            { path: '~/.cache', name: 'User cache' },
            { path: '~/.npm/_cacache', name: 'NPM cache' },
            { path: '~/Library/Caches', name: 'Library caches' },
            { path: '~/.yarn/cache', name: 'Yarn cache' },
            { path: '~/Library/Application Support/Google/DriveFS/*/content_cache', name: 'Google Drive cache' }
        ];

        let totalCacheFreed = 0;

        for (const cache of cacheDirectories) {
            const expandedPath = cache.path.replace('~', process.env.HOME);
            try {
                // Check if directory exists
                const exists = await fs.access(expandedPath).then(() => true).catch(() => false);
                if (!exists) {
                    console.log(`  ${cache.name}: Not found, skipping`);
                    continue;
                }

                const before = await this.getDirectorySize(expandedPath);
                if (before > 0) {
                    console.log(`  ${cache.name}: ${this.formatBytes(before)}`);

                    // Clean the cache
                    if (cache.path.includes('*')) {
                        await execAsync(`bash -c 'rm -rf ${expandedPath}/* 2>/dev/null || true'`);
                    } else {
                        await execAsync(`rm -rf ${expandedPath}/* 2>/dev/null || true`);
                    }

                    const after = await this.getDirectorySize(expandedPath);
                    const freed = before - after;
                    if (freed > 0) {
                        console.log(`    Freed: ${this.formatBytes(freed)}`);
                        totalCacheFreed += freed;
                    }
                } else {
                    console.log(`  ${cache.name}: Already clean`);
                }
            } catch (err) {
                console.log(`  ${cache.name}: Error - ${err.message}`);
            }
        }

        this.totalFreed += totalCacheFreed;
        return totalCacheFreed;
    }

    async cleanOldLogs() {
        console.log('\nCleaning old log files (>30 days)...');

        try {
            const result = await execAsync('find ~ -name "*.log" -mtime +30 -type f -exec du -sb {} \\; 2>/dev/null | awk \'{sum+=$1} END {print sum}\'');
            const logSize = parseInt(result.stdout.trim()) || 0;

            if (logSize > 0) {
                console.log(`  Found ${this.formatBytes(logSize)} of old logs`);
                await execAsync('find ~ -name "*.log" -mtime +30 -type f -delete 2>/dev/null || true');
                console.log(`  Freed: ${this.formatBytes(logSize)}`);
                this.totalFreed += logSize;
                return logSize;
            } else {
                console.log('  No old logs found');
                return 0;
            }
        } catch (err) {
            console.log(`  Error: ${err.message}`);
            return 0;
        }
    }

    async cleanOldDownloads() {
        console.log('\nCleaning old downloads (>30 days)...');

        const downloadsPath = path.join(process.env.HOME, 'Downloads');
        const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);

        let downloadsFreed = 0;
        let fileCount = 0;

        try {
            const files = await fs.readdir(downloadsPath);

            for (const file of files) {
                const filePath = path.join(downloadsPath, file);
                try {
                    const stats = await fs.stat(filePath);

                    if (stats.isFile() && stats.mtime.getTime() < thirtyDaysAgo) {
                        downloadsFreed += stats.size;
                        fileCount++;
                        await fs.unlink(filePath);
                    }
                } catch (err) {
                    // Skip files we can't access
                }
            }

            if (fileCount > 0) {
                console.log(`  Deleted ${fileCount} old files`);
                console.log(`  Freed: ${this.formatBytes(downloadsFreed)}`);
                this.totalFreed += downloadsFreed;
            } else {
                console.log('  No old files found');
            }

            return downloadsFreed;
        } catch (err) {
            console.log(`  Error: ${err.message}`);
            return 0;
        }
    }

    async cleanTempFiles() {
        console.log('\nCleaning temporary files...');

        const tempDirs = [
            { path: '/tmp', name: 'System temp' },
            { path: '~/.tmp', name: 'User temp' }
        ];

        let tempFreed = 0;

        for (const temp of tempDirs) {
            const expandedPath = temp.path.replace('~', process.env.HOME);
            try {
                const before = await this.getDirectorySize(expandedPath);
                if (before > 0) {
                    console.log(`  ${temp.name}: ${this.formatBytes(before)}`);
                    await execAsync(`find ${expandedPath} -type f -mtime +7 -delete 2>/dev/null || true`);
                    const after = await this.getDirectorySize(expandedPath);
                    const freed = before - after;
                    if (freed > 0) {
                        console.log(`    Freed: ${this.formatBytes(freed)}`);
                        tempFreed += freed;
                    }
                }
            } catch (err) {
                console.log(`  ${temp.name}: Error - ${err.message}`);
            }
        }

        this.totalFreed += tempFreed;
        return tempFreed;
    }

    async cleanEmptyDirectories() {
        console.log('\nCleaning empty directories...');

        try {
            const result = await execAsync('find ~ -type d -empty 2>/dev/null | wc -l');
            const emptyCount = parseInt(result.stdout.trim()) || 0;

            if (emptyCount > 0) {
                console.log(`  Found ${emptyCount} empty directories`);
                await execAsync('find ~ -type d -empty -delete 2>/dev/null || true');
                console.log(`  Removed ${emptyCount} empty directories`);
            } else {
                console.log('  No empty directories found');
            }
        } catch (err) {
            console.log(`  Error: ${err.message}`);
        }
    }

    async findLargeFiles() {
        console.log('\nFinding large files (>100MB)...');

        try {
            const result = await execAsync('find ~ -type f -size +100M 2>/dev/null | head -20');
            const files = result.stdout.trim().split('\n').filter(f => f);

            if (files.length > 0) {
                console.log(`  Found ${files.length} large files (showing first 20):\n`);

                for (const file of files) {
                    try {
                        const stats = await fs.stat(file);
                        const size = this.formatBytes(stats.size);
                        const fileName = path.basename(file);
                        console.log(`    ${size.padEnd(12)} ${fileName}`);
                    } catch (err) {
                        // Skip files we can't access
                    }
                }

                console.log('\n  Review these files manually to see if they can be deleted.');
            } else {
                console.log('  No large files found');
            }
        } catch (err) {
            console.log(`  Error: ${err.message}`);
        }
    }

    async run() {
        console.log('=================================================');
        console.log('         STORAGE CLEANUP TOOL');
        console.log('=================================================');

        // Show initial disk usage
        const initialUsage = await this.getDiskUsage();
        if (initialUsage) {
            console.log('\nInitial Disk Usage:');
            console.log(`  Total: ${initialUsage.total}`);
            console.log(`  Used: ${initialUsage.used} (${initialUsage.usePercent})`);
            console.log(`  Available: ${initialUsage.available}`);
        }

        console.log('\n=================================================');
        console.log('Starting cleanup operations...');
        console.log('=================================================');

        // Run cleanup operations
        await this.cleanCaches();
        await this.cleanOldLogs();
        await this.cleanOldDownloads();
        await this.cleanTempFiles();
        await this.cleanEmptyDirectories();

        // Show final results
        console.log('\n=================================================');
        console.log('CLEANUP SUMMARY');
        console.log('=================================================');
        console.log(`Total space freed: ${this.formatBytes(this.totalFreed)}`);

        // Show final disk usage
        const finalUsage = await this.getDiskUsage();
        if (finalUsage) {
            console.log('\nFinal Disk Usage:');
            console.log(`  Total: ${finalUsage.total}`);
            console.log(`  Used: ${finalUsage.used} (${finalUsage.usePercent})`);
            console.log(`  Available: ${finalUsage.available}`);
        }

        // Show large files
        await this.findLargeFiles();

        console.log('\n=================================================');
        console.log('Cleanup complete!');
        console.log('=================================================\n');
    }
}

// Run cleanup if executed directly
if (require.main === module) {
    const cleanup = new CleanupTool();
    cleanup.run().catch(err => {
        console.error('Cleanup failed:', err);
        process.exit(1);
    });
}

module.exports = CleanupTool;
