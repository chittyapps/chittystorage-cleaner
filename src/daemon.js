#!/usr/bin/env node

/**
 * Storage Management Daemon
 * Intelligent, persistent service for managing Google Drive and local storage
 */

const fs = require('fs').promises;
const path = require('path');
const { EventEmitter } = require('events');
const cron = require('node-cron');
const winston = require('winston');
const chokidar = require('chokidar');
const si = require('systeminformation');
const { promisify } = require('util');
const exec = promisify(require('child_process').exec);
const StorageManager = require('./storage-manager');
const SyncEngine = require('./sync-engine');
const IntelligentOrganizer = require('./intelligent-organizer');
const WebDashboard = require('./web-dashboard');
const ConfigManager = require('./config-manager');

class StorageDaemon extends EventEmitter {
    constructor() {
        super();
        this.config = null;
        this.storageManager = null;
        this.syncEngine = null;
        this.organizer = null;
        this.dashboard = null;
        this.watchers = new Map();
        this.isRunning = false;
        this.stats = {
            startTime: Date.now(),
            filesProcessed: 0,
            spaceFreed: 0,
            syncOperations: 0,
            errors: 0
        };
        
        this.setupLogger();
        this.setupSignalHandlers();
    }
    
    setupLogger() {
        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            transports: [
                new winston.transports.File({ 
                    filename: path.join(__dirname, '../logs/error.log'), 
                    level: 'error' 
                }),
                new winston.transports.File({ 
                    filename: path.join(__dirname, '../logs/daemon.log') 
                }),
                new winston.transports.Console({
                    format: winston.format.simple()
                })
            ]
        });
    }
    
    setupSignalHandlers() {
        process.on('SIGINT', () => this.shutdown('SIGINT'));
        process.on('SIGTERM', () => this.shutdown('SIGTERM'));
        process.on('uncaughtException', (err) => {
            this.logger.error('Uncaught exception:', err);
            this.shutdown('uncaughtException');
        });
    }
    
    async initialize() {
        try {
            this.logger.info('Initializing Storage Daemon...');
            
            // Load configuration
            this.config = await ConfigManager.load();
            
            // Initialize components
            this.storageManager = new StorageManager(this.config);
            this.syncEngine = new SyncEngine(this.config);
            this.organizer = new IntelligentOrganizer(this.config);
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Initialize web dashboard
            if (this.config.dashboard.enabled) {
                this.dashboard = new WebDashboard(this);
                await this.dashboard.start(this.config.dashboard.port);
            }
            
            // Setup file watchers
            await this.setupWatchers();
            
            // Setup scheduled tasks
            this.setupScheduledTasks();
            
            this.isRunning = true;
            this.logger.info('Storage Daemon initialized successfully');
            
            // Perform initial scan
            await this.performInitialScan();
            
        } catch (error) {
            this.logger.error('Failed to initialize daemon:', error);
            throw error;
        }
    }
    
    setupEventListeners() {
        // Storage manager events
        this.storageManager.on('space-low', (info) => {
            this.logger.warn('Low disk space detected:', info);
            this.performEmergencyCleanup();
        });
        
        this.storageManager.on('duplicate-found', (files) => {
            this.handleDuplicates(files);
        });
        
        // Sync engine events
        this.syncEngine.on('sync-complete', (result) => {
            this.stats.syncOperations++;
            this.logger.info('Sync completed:', result);
        });
        
        this.syncEngine.on('sync-error', (error) => {
            this.stats.errors++;
            this.logger.error('Sync error:', error);
        });
        
        // Organizer events
        this.organizer.on('file-organized', (info) => {
            this.stats.filesProcessed++;
            this.logger.debug('File organized:', info);
        });
    }
    
    async setupWatchers() {
        const watchPaths = this.config.watch.paths;
        
        for (const watchPath of watchPaths) {
            const watcher = chokidar.watch(watchPath, {
                ignored: this.config.watch.ignore,
                persistent: true,
                awaitWriteFinish: {
                    stabilityThreshold: 2000,
                    pollInterval: 100
                }
            });
            
            watcher
                .on('add', (filePath) => this.handleFileAdd(filePath))
                .on('change', (filePath) => this.handleFileChange(filePath))
                .on('unlink', (filePath) => this.handleFileRemove(filePath));
            
            this.watchers.set(watchPath, watcher);
            this.logger.info(`Watching: ${watchPath}`);
        }
    }
    
    setupScheduledTasks() {
        // Hourly sync
        cron.schedule('0 * * * *', async () => {
            this.logger.info('Running hourly sync...');
            await this.performSync();
        });
        
        // Daily cleanup (3 AM)
        cron.schedule('0 3 * * *', async () => {
            this.logger.info('Running daily cleanup...');
            await this.performCleanup();
        });
        
        // Weekly organization (Sunday 2 AM)
        cron.schedule('0 2 * * 0', async () => {
            this.logger.info('Running weekly organization...');
            await this.performOrganization();
        });
        
        // Real-time critical backup (every 15 minutes)
        cron.schedule('*/15 * * * *', async () => {
            await this.syncCriticalFiles();
        });
        
        // System health check (every 5 minutes)
        cron.schedule('*/5 * * * *', async () => {
            await this.checkSystemHealth();
        });
    }
    
    async performInitialScan() {
        this.logger.info('Performing initial system scan...');
        
        // Check disk usage
        const diskInfo = await this.storageManager.getDiskUsage();
        this.logger.info('Disk usage:', diskInfo);
        
        // Scan for duplicates
        const duplicates = await this.storageManager.findDuplicates();
        if (duplicates.length > 0) {
            this.logger.info(`Found ${duplicates.length} duplicate sets`);
        }
        
        // Check Google Drive status
        const driveStatus = await this.syncEngine.checkDriveStatus();
        this.logger.info('Google Drive status:', driveStatus);
        
        // Identify large files
        const largeFiles = await this.storageManager.findLargeFiles();
        this.logger.info(`Found ${largeFiles.length} large files`);
    }
    
    async handleFileAdd(filePath) {
        try {
            const stats = await fs.stat(filePath);
            
            // Auto-organize based on rules
            if (this.config.autoOrganize.enabled) {
                await this.organizer.organizeFile(filePath);
            }
            
            // Check if file should be backed up
            if (this.shouldBackup(filePath)) {
                await this.syncEngine.backupFile(filePath);
            }
            
            // Check for duplicates
            if (stats.size > 1024 * 1024) { // Only for files > 1MB
                await this.storageManager.checkDuplicate(filePath);
            }
            
        } catch (error) {
            this.logger.error(`Error handling file add: ${filePath}`, error);
        }
    }
    
    async handleFileChange(filePath) {
        try {
            // Queue for next sync if it's a tracked file
            if (this.syncEngine.isTracked(filePath)) {
                await this.syncEngine.queueForSync(filePath);
            }
        } catch (error) {
            this.logger.error(`Error handling file change: ${filePath}`, error);
        }
    }
    
    async handleFileRemove(filePath) {
        try {
            // Update tracking database
            await this.storageManager.removeFromTracking(filePath);
        } catch (error) {
            this.logger.error(`Error handling file removal: ${filePath}`, error);
        }
    }
    
    shouldBackup(filePath) {
        // Check against backup rules
        const rules = this.config.backup.rules;
        const ext = path.extname(filePath).toLowerCase();
        const dir = path.dirname(filePath);
        
        // Check if in critical directories
        if (rules.critical.some(critPath => dir.includes(critPath))) {
            return true;
        }
        
        // Check file extensions
        if (rules.extensions.includes(ext)) {
            return true;
        }
        
        // Check file patterns
        return rules.patterns.some(pattern => 
            new RegExp(pattern).test(path.basename(filePath))
        );
    }
    
    async performSync() {
        try {
            const results = await this.syncEngine.performFullSync();
            this.stats.syncOperations++;
            this.emit('sync-complete', results);
        } catch (error) {
            this.logger.error('Sync failed:', error);
            this.stats.errors++;
        }
    }
    
    async performCleanup() {
        try {
            const freed = await this.storageManager.performCleanup();
            this.stats.spaceFreed += freed;
            this.logger.info(`Cleanup freed ${this.formatBytes(freed)}`);
        } catch (error) {
            this.logger.error('Cleanup failed:', error);
        }
    }
    
    async performOrganization() {
        try {
            const results = await this.organizer.organizeAll();
            this.stats.filesProcessed += results.processed;
            this.logger.info('Organization complete:', results);
        } catch (error) {
            this.logger.error('Organization failed:', error);
        }
    }
    
    async syncCriticalFiles() {
        try {
            await this.syncEngine.syncCritical();
        } catch (error) {
            this.logger.error('Critical sync failed:', error);
        }
    }
    
    async checkSystemHealth() {
        try {
            const health = {
                disk: await si.fsSize(),
                memory: await si.mem(),
                uptime: Date.now() - this.stats.startTime,
                stats: this.stats
            };
            
            // Check if intervention needed
            const mainDisk = health.disk.find(d => d.mount === '/');
            if (mainDisk && mainDisk.use > 90) {
                await this.performEmergencyCleanup();
            }
            
            // Update dashboard if running
            if (this.dashboard) {
                this.dashboard.updateHealth(health);
            }
            
        } catch (error) {
            this.logger.error('Health check failed:', error);
        }
    }
    
    async performEmergencyCleanup() {
        this.logger.warn('Performing emergency cleanup...');
        
        try {
            // Clear caches
            await exec('rm -rf ~/Library/Caches/* 2>/dev/null || true');
            
            // Clear old logs
            await exec('find ~ -name "*.log" -mtime +7 -delete 2>/dev/null || true');
            
            // Clear Google Drive cache if needed
            const driveCache = '/Users/nb/Library/Application Support/Google/DriveFS';
            const stats = await fs.stat(driveCache).catch(() => null);
            if (stats) {
                await exec(`find "${driveCache}" -name "*cache*" -exec rm -rf {} + 2>/dev/null || true`);
            }
            
            const freed = await this.storageManager.calculateFreedSpace();
            this.stats.spaceFreed += freed;
            this.logger.info(`Emergency cleanup freed ${this.formatBytes(freed)}`);
            
        } catch (error) {
            this.logger.error('Emergency cleanup failed:', error);
        }
    }
    
    async handleDuplicates(duplicates) {
        for (const group of duplicates) {
            try {
                await this.organizer.resolveDuplicates(group);
            } catch (error) {
                this.logger.error('Failed to resolve duplicates:', error);
            }
        }
    }
    
    formatBytes(bytes) {
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        if (bytes === 0) return '0 B';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }
    
    async getStatus() {
        return {
            running: this.isRunning,
            uptime: Date.now() - this.stats.startTime,
            stats: this.stats,
            config: this.config,
            watchers: Array.from(this.watchers.keys())
        };
    }
    
    async shutdown(signal) {
        this.logger.info(`Shutting down daemon (${signal})...`);
        this.isRunning = false;
        
        // Stop watchers
        for (const [path, watcher] of this.watchers) {
            await watcher.close();
        }
        
        // Stop dashboard
        if (this.dashboard) {
            await this.dashboard.stop();
        }
        
        // Save state
        await this.saveState();
        
        this.logger.info('Daemon shutdown complete');
        process.exit(0);
    }
    
    async saveState() {
        const state = {
            stats: this.stats,
            lastRun: Date.now()
        };
        
        await fs.writeFile(
            path.join(__dirname, '../state.json'),
            JSON.stringify(state, null, 2)
        );
    }
}

// Start the daemon
if (require.main === module) {
    const daemon = new StorageDaemon();
    
    daemon.initialize().catch(error => {
        console.error('Failed to start daemon:', error);
        process.exit(1);
    });
    
    console.log('Storage Management Daemon started');
    console.log('Dashboard: http://localhost:3456');
    console.log('Logs: ~/storage-daemon/logs/');
}

module.exports = StorageDaemon;