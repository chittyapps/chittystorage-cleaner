const fs = require('fs').promises;
const path = require('path');
const { EventEmitter } = require('events');
const { promisify } = require('util');
const exec = promisify(require('child_process').exec);
const Queue = require('./simple-queue');

class SyncEngine extends EventEmitter {
    constructor(config) {
        super();
        this.config = config;
        this.syncQueue = new Queue(this.processSyncTask.bind(this), {
            concurrent: 2,
            maxRetries: 3,
            retryDelay: 5000
        });
        
        this.driveBasePath = '/Users/nb/Library/CloudStorage/GoogleDrive-nick@aribia.llc/Shared drives';
        this.drives = {
            aribia: `${this.driveBasePath}/ARIBIA LLC`,
            arias: `${this.driveBasePath}/Arias V Bianchi`,
            main: `${this.driveBasePath}/MAIN`,
            personal: `${this.driveBasePath}/Personal`,
            thumb: `${this.driveBasePath}/Thumb`,
            workflows: `${this.driveBasePath}/Workflows & Operations`
        };
        
        this.criticalPaths = new Set(config.backup.critical || []);
        this.trackedFiles = new Map();
    }
    
    async checkDriveStatus() {
        const status = {};
        
        for (const [name, drivePath] of Object.entries(this.drives)) {
            try {
                await fs.access(drivePath);
                const stats = await fs.stat(drivePath);
                status[name] = {
                    available: true,
                    path: drivePath,
                    modified: stats.mtime
                };
            } catch (err) {
                status[name] = {
                    available: false,
                    path: drivePath,
                    error: err.message
                };
            }
        }
        
        return status;
    }
    
    async performFullSync() {
        const results = {
            synced: 0,
            failed: 0,
            skipped: 0,
            errors: []
        };
        
        try {
            // Sync critical directories first
            for (const criticalPath of this.criticalPaths) {
                await this.syncDirectory(criticalPath, 'critical');
                results.synced++;
            }
            
            // Sync other configured paths
            for (const syncConfig of this.config.sync.paths) {
                try {
                    await this.syncDirectory(syncConfig.source, syncConfig.category);
                    results.synced++;
                } catch (err) {
                    results.failed++;
                    results.errors.push({
                        path: syncConfig.source,
                        error: err.message
                    });
                }
            }
            
            this.emit('sync-complete', results);
        } catch (err) {
            this.emit('sync-error', err);
            throw err;
        }
        
        return results;
    }
    
    async syncDirectory(sourcePath, category = 'general') {
        const expandedPath = sourcePath.replace('~', process.env.HOME);
        
        // Determine destination based on category
        const destination = this.getDestinationForCategory(category);
        
        if (!destination) {
            throw new Error(`No destination configured for category: ${category}`);
        }
        
        // Create backup directory with date
        const backupDir = path.join(destination, 'Backups', new Date().toISOString().split('T')[0]);
        await fs.mkdir(backupDir, { recursive: true });
        
        // Use rsync for efficient syncing
        const rsyncCmd = `rsync -av --progress --exclude='.DS_Store' --exclude='node_modules' --exclude='.git' "${expandedPath}/" "${backupDir}/"`;
        
        try {
            const result = await exec(rsyncCmd);
            return {
                success: true,
                source: expandedPath,
                destination: backupDir,
                output: result.stdout
            };
        } catch (err) {
            throw new Error(`Sync failed: ${err.message}`);
        }
    }
    
    getDestinationForCategory(category) {
        const categoryMap = {
            critical: this.drives.main,
            legal: this.drives.arias,
            business: this.drives.aribia,
            development: this.drives.main,
            personal: this.drives.personal,
            archive: this.drives.thumb,
            operations: this.drives.workflows,
            general: this.drives.thumb
        };
        
        return categoryMap[category] || this.drives.thumb;
    }
    
    async backupFile(filePath) {
        const category = this.categorizeFile(filePath);
        const destination = this.getDestinationForCategory(category);
        
        if (!destination) {
            throw new Error('No suitable destination for file');
        }
        
        const fileName = path.basename(filePath);
        const destPath = path.join(destination, 'Backups', category, fileName);
        
        await fs.mkdir(path.dirname(destPath), { recursive: true });
        await fs.copyFile(filePath, destPath);
        
        // Track the file
        this.trackedFiles.set(filePath, {
            destination: destPath,
            lastSync: Date.now(),
            category
        });
        
        return destPath;
    }
    
    categorizeFile(filePath) {
        const lowerPath = filePath.toLowerCase();
        
        // Check for specific patterns
        if (lowerPath.includes('arias') || lowerPath.includes('legal') || lowerPath.includes('court')) {
            return 'legal';
        }
        if (lowerPath.includes('business') || lowerPath.includes('aribia') || lowerPath.includes('llc')) {
            return 'business';
        }
        if (lowerPath.includes('development') || lowerPath.includes('code') || lowerPath.includes('project')) {
            return 'development';
        }
        if (lowerPath.includes('personal') || lowerPath.includes('documents')) {
            return 'personal';
        }
        
        // Check by extension
        const ext = path.extname(filePath).toLowerCase();
        const devExtensions = ['.js', '.py', '.java', '.cpp', '.go', '.rs', '.swift'];
        const docExtensions = ['.pdf', '.doc', '.docx', '.txt'];
        
        if (devExtensions.includes(ext)) {
            return 'development';
        }
        if (docExtensions.includes(ext)) {
            return 'personal';
        }
        
        return 'general';
    }
    
    isTracked(filePath) {
        return this.trackedFiles.has(filePath);
    }
    
    async queueForSync(filePath) {
        return new Promise((resolve, reject) => {
            this.syncQueue.push({
                type: 'file',
                path: filePath,
                priority: this.criticalPaths.has(filePath) ? 1 : 5
            }, (err, result) => {
                if (err) reject(err);
                else resolve(result);
            });
        });
    }
    
    async processSyncTask(task, callback) {
        try {
            let result;
            
            if (task.type === 'file') {
                result = await this.backupFile(task.path);
            } else if (task.type === 'directory') {
                result = await this.syncDirectory(task.path, task.category);
            }
            
            callback(null, result);
        } catch (err) {
            callback(err);
        }
    }
    
    async syncCritical() {
        const results = [];
        
        for (const criticalPath of this.criticalPaths) {
            try {
                const result = await this.syncDirectory(criticalPath, 'critical');
                results.push(result);
            } catch (err) {
                this.emit('sync-error', {
                    path: criticalPath,
                    error: err
                });
            }
        }
        
        return results;
    }
    
    async verifyBackups() {
        const verification = {
            total: this.trackedFiles.size,
            verified: 0,
            missing: [],
            outdated: []
        };
        
        for (const [sourcePath, info] of this.trackedFiles) {
            try {
                // Check if backup exists
                await fs.access(info.destination);
                
                // Check if backup is up to date
                const sourceStats = await fs.stat(sourcePath);
                const destStats = await fs.stat(info.destination);
                
                if (sourceStats.mtime > destStats.mtime) {
                    verification.outdated.push(sourcePath);
                } else {
                    verification.verified++;
                }
            } catch (err) {
                verification.missing.push(sourcePath);
            }
        }
        
        return verification;
    }
    
    async getyncStats() {
        return {
            queueLength: this.syncQueue.length,
            trackedFiles: this.trackedFiles.size,
            criticalPaths: this.criticalPaths.size,
            driveStatus: await this.checkDriveStatus()
        };
    }
}

module.exports = SyncEngine;