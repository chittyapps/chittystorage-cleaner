const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { EventEmitter } = require('events');
const sqlite3 = require('sqlite3').verbose();
const { promisify } = require('util');
const exec = promisify(require('child_process').exec);

class StorageManager extends EventEmitter {
    constructor(config) {
        super();
        this.config = config;
        this.db = null;
        this.initDatabase();
    }
    
    async initDatabase() {
        const dbPath = path.join(__dirname, '../data/storage.db');
        await fs.mkdir(path.dirname(dbPath), { recursive: true });
        
        this.db = new sqlite3.Database(dbPath);
        
        // Promisify database methods
        this.dbRun = promisify(this.db.run.bind(this.db));
        this.dbGet = promisify(this.db.get.bind(this.db));
        this.dbAll = promisify(this.db.all.bind(this.db));
        
        // Create tables
        await this.dbRun(`
            CREATE TABLE IF NOT EXISTS files (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                path TEXT UNIQUE,
                hash TEXT,
                size INTEGER,
                modified INTEGER,
                backed_up INTEGER DEFAULT 0,
                last_sync INTEGER,
                category TEXT
            )
        `);
        
        await this.dbRun(`
            CREATE TABLE IF NOT EXISTS duplicates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                hash TEXT,
                paths TEXT,
                size INTEGER,
                count INTEGER,
                resolved INTEGER DEFAULT 0
            )
        `);
        
        await this.dbRun(`
            CREATE INDEX IF NOT EXISTS idx_hash ON files(hash)
        `);
    }
    
    async getDiskUsage() {
        const result = await exec('df -h / | tail -1');
        const parts = result.stdout.trim().split(/\s+/);
        
        return {
            total: parts[1],
            used: parts[2],
            available: parts[3],
            usePercent: parseInt(parts[4]),
            mount: parts[8] || '/'
        };
    }
    
    async findDuplicates(scanPath = process.env.HOME) {
        const fileMap = new Map();
        const duplicates = [];
        
        async function scanDirectory(dir) {
            try {
                const entries = await fs.readdir(dir, { withFileTypes: true });
                
                for (const entry of entries) {
                    const fullPath = path.join(dir, entry.name);
                    
                    // Skip certain directories
                    if (entry.isDirectory()) {
                        if (!['node_modules', '.git', 'Library', '.cache'].includes(entry.name)) {
                            await scanDirectory(fullPath);
                        }
                    } else if (entry.isFile()) {
                        try {
                            const stats = await fs.stat(fullPath);
                            
                            // Only check files > 1MB
                            if (stats.size > 1024 * 1024) {
                                const hash = await this.hashFile(fullPath);
                                
                                if (fileMap.has(hash)) {
                                    fileMap.get(hash).push(fullPath);
                                } else {
                                    fileMap.set(hash, [fullPath]);
                                }
                            }
                        } catch (err) {
                            // Skip files we can't read
                        }
                    }
                }
            } catch (err) {
                // Skip directories we can't read
            }
        }
        
        await scanDirectory(scanPath);
        
        // Find duplicates
        for (const [hash, paths] of fileMap) {
            if (paths.length > 1) {
                const stats = await fs.stat(paths[0]);
                duplicates.push({
                    hash,
                    paths,
                    size: stats.size,
                    count: paths.length,
                    potentialSaving: stats.size * (paths.length - 1)
                });
                
                // Store in database
                await this.dbRun(
                    'INSERT OR REPLACE INTO duplicates (hash, paths, size, count) VALUES (?, ?, ?, ?)',
                    [hash, JSON.stringify(paths), stats.size, paths.length]
                );
            }
        }
        
        // Emit event if duplicates found
        if (duplicates.length > 0) {
            this.emit('duplicate-found', duplicates);
        }
        
        return duplicates;
    }
    
    async hashFile(filePath, algorithm = 'md5') {
        return new Promise((resolve, reject) => {
            const hash = crypto.createHash(algorithm);
            const stream = require('fs').createReadStream(filePath);
            
            stream.on('data', data => hash.update(data));
            stream.on('end', () => resolve(hash.digest('hex')));
            stream.on('error', reject);
        });
    }
    
    async findLargeFiles(minSize = 100 * 1024 * 1024) { // 100MB default
        const largeFiles = [];
        
        async function scan(dir) {
            try {
                const entries = await fs.readdir(dir, { withFileTypes: true });
                
                for (const entry of entries) {
                    const fullPath = path.join(dir, entry.name);
                    
                    if (entry.isDirectory()) {
                        if (!['node_modules', '.git', 'Library'].includes(entry.name)) {
                            await scan(fullPath);
                        }
                    } else if (entry.isFile()) {
                        try {
                            const stats = await fs.stat(fullPath);
                            if (stats.size >= minSize) {
                                largeFiles.push({
                                    path: fullPath,
                                    size: stats.size,
                                    modified: stats.mtime
                                });
                            }
                        } catch (err) {
                            // Skip
                        }
                    }
                }
            } catch (err) {
                // Skip
            }
        }
        
        await scan(process.env.HOME);
        
        return largeFiles.sort((a, b) => b.size - a.size);
    }
    
    async performCleanup() {
        let totalFreed = 0;
        
        // Clean caches
        const cacheDirectories = [
            '~/Library/Caches',
            '~/.cache',
            '~/.npm/_cacache',
            '~/Library/Application Support/Google/DriveFS/*/content_cache'
        ];
        
        for (const dir of cacheDirectories) {
            const expandedPath = dir.replace('~', process.env.HOME);
            try {
                const before = await this.getDirectorySize(expandedPath);
                await exec(`rm -rf ${expandedPath}/* 2>/dev/null || true`);
                const after = await this.getDirectorySize(expandedPath);
                totalFreed += (before - after);
            } catch (err) {
                // Continue with next
            }
        }
        
        // Clean old logs
        await exec('find ~ -name "*.log" -mtime +30 -delete 2>/dev/null || true');
        
        // Clean old downloads
        const downloadsPath = path.join(process.env.HOME, 'Downloads');
        const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
        
        try {
            const files = await fs.readdir(downloadsPath);
            for (const file of files) {
                const filePath = path.join(downloadsPath, file);
                const stats = await fs.stat(filePath);
                
                if (stats.mtime.getTime() < thirtyDaysAgo) {
                    totalFreed += stats.size;
                    await fs.unlink(filePath).catch(() => {});
                }
            }
        } catch (err) {
            // Continue
        }
        
        // Clean empty directories
        await exec('find ~ -type d -empty -delete 2>/dev/null || true');
        
        return totalFreed;
    }
    
    async getDirectorySize(dirPath) {
        try {
            const result = await exec(`du -sb "${dirPath}" 2>/dev/null | cut -f1`);
            return parseInt(result.stdout.trim()) || 0;
        } catch (err) {
            return 0;
        }
    }
    
    async checkDuplicate(filePath) {
        try {
            const hash = await this.hashFile(filePath);
            const existing = await this.dbGet(
                'SELECT * FROM files WHERE hash = ? AND path != ?',
                [hash, filePath]
            );
            
            if (existing) {
                this.emit('duplicate-found', [{
                    hash,
                    paths: [existing.path, filePath],
                    size: existing.size
                }]);
                return true;
            }
            
            // Add to database
            const stats = await fs.stat(filePath);
            await this.dbRun(
                'INSERT OR REPLACE INTO files (path, hash, size, modified) VALUES (?, ?, ?, ?)',
                [filePath, hash, stats.size, stats.mtime.getTime()]
            );
            
            return false;
        } catch (err) {
            console.error('Error checking duplicate:', err);
            return false;
        }
    }
    
    async removeFromTracking(filePath) {
        await this.dbRun('DELETE FROM files WHERE path = ?', [filePath]);
    }
    
    async calculateFreedSpace() {
        // This would track actual freed space during operations
        // For now, estimate based on common cache sizes
        const cacheSize = await this.getDirectorySize(
            path.join(process.env.HOME, 'Library/Caches')
        );
        return cacheSize;
    }
    
    async getStorageStats() {
        const diskUsage = await this.getDiskUsage();
        const fileCount = await this.dbGet('SELECT COUNT(*) as count FROM files');
        const duplicateCount = await this.dbGet('SELECT COUNT(*) as count FROM duplicates WHERE resolved = 0');
        
        return {
            disk: diskUsage,
            trackedFiles: fileCount.count,
            unresolvedDuplicates: duplicateCount.count
        };
    }
}

module.exports = StorageManager;