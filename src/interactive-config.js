#!/usr/bin/env node

/**
 * Interactive Configuration Tool for Storage Management Daemon
 */

const fs = require('fs').promises;
const path = require('path');
const readline = require('readline');
const ConfigManager = require('./config-manager');

class InteractiveConfig {
    constructor() {
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        this.config = null;
    }
    
    async start() {
        console.log('🔧 Storage Management Daemon - Interactive Configuration');
        console.log('=====================================\n');
        
        try {
            this.config = await ConfigManager.load();
            await this.showMainMenu();
        } catch (error) {
            console.error('Error loading configuration:', error.message);
            process.exit(1);
        }
    }
    
    async showMainMenu() {
        console.log('\n📋 Configuration Menu:');
        console.log('1. Dashboard Settings');
        console.log('2. File Monitoring');
        console.log('3. Google Drive Sync'); 
        console.log('4. Auto Organization');
        console.log('5. Backup Schedule');
        console.log('6. Cleanup Settings');
        console.log('7. Security Options');
        console.log('8. View Current Config');
        console.log('9. Save & Exit');
        console.log('0. Exit without saving');
        
        const choice = await this.ask('\nSelect option (0-9): ');
        
        switch (choice) {
            case '1': await this.configureDashboard(); break;
            case '2': await this.configureMonitoring(); break;
            case '3': await this.configureGoogleDrive(); break;
            case '4': await this.configureOrganization(); break;
            case '5': await this.configureBackup(); break;
            case '6': await this.configureCleanup(); break;
            case '7': await this.configureSecurity(); break;
            case '8': await this.viewConfig(); break;
            case '9': await this.saveAndExit(); break;
            case '0': await this.exit(); break;
            default:
                console.log('Invalid option. Please try again.');
                await this.showMainMenu();
        }
    }
    
    async configureDashboard() {
        console.log('\n🌐 Dashboard Configuration');
        console.log('=======================');
        
        const enabled = await this.askYesNo(`Enable web dashboard? [${this.config.dashboard.enabled ? 'Y' : 'N'}]: `, this.config.dashboard.enabled);
        this.config.dashboard.enabled = enabled;
        
        if (enabled) {
            const port = await this.askNumber(`Dashboard port [${this.config.dashboard.port}]: `, this.config.dashboard.port, 1024, 65535);
            this.config.dashboard.port = port;
            
            const host = await this.askString(`Host binding [${this.config.dashboard.host}]: `, this.config.dashboard.host);
            this.config.dashboard.host = host;
            
            const auth = await this.askYesNo(`Enable authentication? [${this.config.dashboard.auth ? 'Y' : 'N'}]: `, this.config.dashboard.auth);
            this.config.dashboard.auth = auth;
            
            if (auth) {
                const username = await this.askString('Username: ');
                const password = await this.askString('Password: ', '', true);
                this.config.dashboard.credentials = { username, password };
            }
        }
        
        console.log('✅ Dashboard configuration updated');
        await this.showMainMenu();
    }
    
    async configureMonitoring() {
        console.log('\n👀 File Monitoring Configuration');
        console.log('==============================');
        
        const enabled = await this.askYesNo(`Enable file monitoring? [${this.config.watch.enabled ? 'Y' : 'N'}]: `, this.config.watch.enabled);
        this.config.watch.enabled = enabled;
        
        if (enabled) {
            console.log('\nCurrent watched paths:');
            this.config.watch.paths.forEach((path, i) => {
                console.log(`  ${i + 1}. ${path}`);
            });
            
            const managePaths = await this.askYesNo('\nModify watched paths? [N]: ', false);
            if (managePaths) {
                await this.managePaths();
            }
            
            const manageIgnore = await this.askYesNo('Modify ignore patterns? [N]: ', false);
            if (manageIgnore) {
                await this.manageIgnorePatterns();
            }
        }
        
        console.log('✅ Monitoring configuration updated');
        await this.showMainMenu();
    }
    
    async configureGoogleDrive() {
        console.log('\n☁️ Google Drive Configuration');
        console.log('===========================');
        
        const enabled = await this.askYesNo(`Enable Google Drive sync? [${this.config.sync.enabled ? 'Y' : 'N'}]: `, this.config.sync.enabled);
        this.config.sync.enabled = enabled;
        
        if (enabled) {
            const currentPath = this.config.sync.googleDrive?.basePath || '';
            console.log(`\nCurrent base path: ${currentPath}`);
            
            const changePath = await this.askYesNo('Change Google Drive base path? [N]: ', false);
            if (changePath) {
                const newPath = await this.askString('Enter new base path: ');
                if (!this.config.sync.googleDrive) {
                    this.config.sync.googleDrive = {};
                }
                this.config.sync.googleDrive.basePath = newPath;
                this.config.sync.googleDrive.enabled = true;
            }
            
            console.log('\nSync path mappings:');
            this.config.sync.paths.forEach((mapping, i) => {
                console.log(`  ${i + 1}. ${mapping.source} → ${mapping.category}`);
            });
            
            const modifyMappings = await this.askYesNo('\nModify sync mappings? [N]: ', false);
            if (modifyMappings) {
                await this.manageSyncMappings();
            }
        }
        
        console.log('✅ Google Drive configuration updated');
        await this.showMainMenu();
    }
    
    async configureOrganization() {
        console.log('\n📁 Auto Organization Configuration');
        console.log('================================');
        
        const enabled = await this.askYesNo(`Enable auto organization? [${this.config.autoOrganize.enabled ? 'Y' : 'N'}]: `, this.config.autoOrganize.enabled);
        this.config.autoOrganize.enabled = enabled;
        
        if (enabled) {
            const moveAfter = await this.askNumber(`Move files after days [${this.config.autoOrganize.rules.moveAfterDays}]: `, this.config.autoOrganize.rules.moveAfterDays, 1, 365);
            this.config.autoOrganize.rules.moveAfterDays = moveAfter;
            
            const archiveAfter = await this.askNumber(`Archive files after days [${this.config.autoOrganize.rules.archiveAfterDays}]: `, this.config.autoOrganize.rules.archiveAfterDays, 1, 365);
            this.config.autoOrganize.rules.archiveAfterDays = archiveAfter;
            
            const deleteAfter = await this.askNumber(`Delete files after days [${this.config.autoOrganize.rules.deleteAfterDays}]: `, this.config.autoOrganize.rules.deleteAfterDays, 1, 3650);
            this.config.autoOrganize.rules.deleteAfterDays = deleteAfter;
        }
        
        console.log('✅ Organization configuration updated');
        await this.showMainMenu();
    }
    
    async configureBackup() {
        console.log('\n💾 Backup Schedule Configuration');
        console.log('==============================');
        
        const enabled = await this.askYesNo(`Enable backups? [${this.config.backup.enabled ? 'Y' : 'N'}]: `, this.config.backup.enabled);
        this.config.backup.enabled = enabled;
        
        if (enabled) {
            console.log('\nCurrent schedules (cron format):');
            console.log(`  Critical: ${this.config.backup.schedule.critical}`);
            console.log(`  Regular:  ${this.config.backup.schedule.regular}`);
            console.log(`  Full:     ${this.config.backup.schedule.full}`);
            
            const modifySchedule = await this.askYesNo('\nModify backup schedules? [N]: ', false);
            if (modifySchedule) {
                console.log('\nCron format: minute hour day month weekday');
                console.log('Examples: */15 * * * * (every 15 min), 0 3 * * * (daily 3am)');
                
                const critical = await this.askString(`Critical backup schedule [${this.config.backup.schedule.critical}]: `, this.config.backup.schedule.critical);
                this.config.backup.schedule.critical = critical;
                
                const regular = await this.askString(`Regular backup schedule [${this.config.backup.schedule.regular}]: `, this.config.backup.schedule.regular);
                this.config.backup.schedule.regular = regular;
                
                const full = await this.askString(`Full backup schedule [${this.config.backup.schedule.full}]: `, this.config.backup.schedule.full);
                this.config.backup.schedule.full = full;
            }
        }
        
        console.log('✅ Backup configuration updated');
        await this.showMainMenu();
    }
    
    async configureCleanup() {
        console.log('\n🧹 Cleanup Settings Configuration');
        console.log('===============================');
        
        const enabled = await this.askYesNo(`Enable automatic cleanup? [${this.config.cleanup.enabled ? 'Y' : 'N'}]: `, this.config.cleanup.enabled);
        this.config.cleanup.enabled = enabled;
        
        if (enabled) {
            const aggressive = await this.askYesNo(`Aggressive cleanup mode? [${this.config.cleanup.aggressive ? 'Y' : 'N'}]: `, this.config.cleanup.aggressive);
            this.config.cleanup.aggressive = aggressive;
            
            const diskThreshold = await this.askNumber(`Disk usage threshold % [${this.config.monitoring.diskThreshold}]: `, this.config.monitoring.diskThreshold, 50, 99);
            this.config.monitoring.diskThreshold = diskThreshold;
            
            const maxCacheGB = Math.round(this.config.cleanup.maxCacheSize / 1073741824);
            const newCacheGB = await this.askNumber(`Max cache size (GB) [${maxCacheGB}]: `, maxCacheGB, 1, 100);
            this.config.cleanup.maxCacheSize = newCacheGB * 1073741824;
        }
        
        console.log('✅ Cleanup configuration updated');
        await this.showMainMenu();
    }
    
    async configureSecurity() {
        console.log('\n🔒 Security Configuration');
        console.log('=======================');
        
        if (!this.config.security) {
            this.config.security = {};
        }
        
        const auditLog = await this.askYesNo(`Enable audit logging? [${this.config.security.enableAuditLog ? 'Y' : 'N'}]: `, this.config.security.enableAuditLog || false);
        this.config.security.enableAuditLog = auditLog;
        
        const maxFileSizeMB = Math.round((this.config.security.maxFileSize || 1073741824) / 1048576);
        const newMaxFileSizeMB = await this.askNumber(`Max file size (MB) [${maxFileSizeMB}]: `, maxFileSizeMB, 1, 10240);
        this.config.security.maxFileSize = newMaxFileSizeMB * 1048576;
        
        console.log('✅ Security configuration updated');
        await this.showMainMenu();
    }
    
    async viewConfig() {
        console.log('\n📄 Current Configuration');
        console.log('======================');
        console.log(JSON.stringify(this.config, null, 2));
        
        await this.ask('\nPress Enter to continue...');
        await this.showMainMenu();
    }
    
    async managePaths() {
        while (true) {
            console.log('\n📁 Path Management:');
            console.log('1. Add path');
            console.log('2. Remove path');
            console.log('3. Back to main menu');
            
            const choice = await this.ask('Select option: ');
            
            if (choice === '1') {
                const newPath = await this.askString('Enter path to watch: ');
                if (newPath && !this.config.watch.paths.includes(newPath)) {
                    this.config.watch.paths.push(newPath);
                    console.log(`✅ Added: ${newPath}`);
                }
            } else if (choice === '2') {
                console.log('\nCurrent paths:');
                this.config.watch.paths.forEach((path, i) => {
                    console.log(`  ${i + 1}. ${path}`);
                });
                
                const index = await this.askNumber('Remove path number: ', 0, 1, this.config.watch.paths.length);
                if (index > 0) {
                    const removed = this.config.watch.paths.splice(index - 1, 1)[0];
                    console.log(`✅ Removed: ${removed}`);
                }
            } else {
                break;
            }
        }
    }
    
    async manageSyncMappings() {
        while (true) {
            console.log('\n🔄 Sync Mapping Management:');
            console.log('1. Add mapping');
            console.log('2. Remove mapping');
            console.log('3. Back to main menu');
            
            const choice = await this.ask('Select option: ');
            
            if (choice === '1') {
                const source = await this.askString('Source path: ');
                const category = await this.askString('Category (business/development/documents/legal/personal): ');
                
                if (source && category) {
                    this.config.sync.paths.push({ source, category });
                    console.log(`✅ Added mapping: ${source} → ${category}`);
                }
            } else if (choice === '2') {
                console.log('\nCurrent mappings:');
                this.config.sync.paths.forEach((mapping, i) => {
                    console.log(`  ${i + 1}. ${mapping.source} → ${mapping.category}`);
                });
                
                const index = await this.askNumber('Remove mapping number: ', 0, 1, this.config.sync.paths.length);
                if (index > 0) {
                    const removed = this.config.sync.paths.splice(index - 1, 1)[0];
                    console.log(`✅ Removed: ${removed.source} → ${removed.category}`);
                }
            } else {
                break;
            }
        }
    }
    
    async saveAndExit() {
        try {
            await ConfigManager.save(this.config);
            console.log('\n✅ Configuration saved successfully!');
            console.log('🔄 Restart the daemon to apply changes: storage-daemon restart');
        } catch (error) {
            console.error('❌ Error saving configuration:', error.message);
        }
        
        this.rl.close();
        process.exit(0);
    }
    
    async exit() {
        const save = await this.askYesNo('Save changes before exiting? [Y]: ', true);
        if (save) {
            await this.saveAndExit();
        } else {
            console.log('Exiting without saving...');
            this.rl.close();
            process.exit(0);
        }
    }
    
    // Helper methods
    async ask(question) {
        return new Promise((resolve) => {
            this.rl.question(question, resolve);
        });
    }
    
    async askString(question, defaultValue = '', hidden = false) {
        const answer = await this.ask(question);
        return answer.trim() || defaultValue;
    }
    
    async askNumber(question, defaultValue, min = 0, max = Infinity) {
        while (true) {
            const answer = await this.ask(question);
            const num = answer.trim() === '' ? defaultValue : parseInt(answer);
            
            if (!isNaN(num) && num >= min && num <= max) {
                return num;
            }
            
            console.log(`Please enter a number between ${min} and ${max}`);
        }
    }
    
    async askYesNo(question, defaultValue = false) {
        const answer = await this.ask(question);
        const normalized = answer.trim().toLowerCase();
        
        if (normalized === '') return defaultValue;
        return normalized === 'y' || normalized === 'yes';
    }
}

// Run if called directly
if (require.main === module) {
    const config = new InteractiveConfig();
    config.start().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = InteractiveConfig;