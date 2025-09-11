const fs = require('fs').promises;
const path = require('path');

class ConfigManager {
    static async load() {
        const configPath = path.join(__dirname, '../config/daemon.config.json');
        
        // Check if config exists, otherwise create default
        try {
            await fs.access(configPath);
            const configData = await fs.readFile(configPath, 'utf8');
            return JSON.parse(configData);
        } catch (error) {
            // Create default configuration
            const defaultConfig = this.getDefaultConfig();
            await this.save(defaultConfig);
            return defaultConfig;
        }
    }
    
    static async save(config) {
        const configPath = path.join(__dirname, '../config/daemon.config.json');
        await fs.mkdir(path.dirname(configPath), { recursive: true });
        await fs.writeFile(configPath, JSON.stringify(config, null, 2));
    }
    
    static getDefaultConfig() {
        return {
            daemon: {
                name: 'Storage Management Daemon',
                version: '1.0.0',
                logLevel: 'info',
                startOnBoot: true
            },
            
            dashboard: {
                enabled: true,
                port: 3456,
                host: 'localhost',
                auth: false
            },
            
            watch: {
                enabled: true,
                paths: [
                    `${process.env.HOME}/Downloads`,
                    `${process.env.HOME}/Desktop`,
                    `${process.env.HOME}/Documents`
                ],
                ignore: [
                    '**/.DS_Store',
                    '**/node_modules/**',
                    '**/.git/**',
                    '**/*.tmp',
                    '**/.cache/**'
                ]
            },
            
            backup: {
                enabled: true,
                critical: [
                    `${process.env.HOME}/Documents`,
                    `${process.env.HOME}/Business`,
                    `${process.env.HOME}/.arias_evidence_vault`
                ],
                rules: {
                    critical: [
                        '/Documents/Legal',
                        '/Business',
                        '/.arias'
                    ],
                    extensions: [
                        '.pdf', '.doc', '.docx', '.xls', '.xlsx',
                        '.jpg', '.png', '.mp4'
                    ],
                    patterns: [
                        'contract', 'agreement', 'invoice', 'receipt'
                    ]
                },
                schedule: {
                    critical: '*/15 * * * *', // Every 15 minutes
                    regular: '0 * * * *',     // Every hour
                    full: '0 3 * * *'         // Daily at 3 AM
                }
            },
            
            sync: {
                enabled: true,
                paths: [
                    {
                        source: `${process.env.HOME}/Business`,
                        category: 'business'
                    },
                    {
                        source: `${process.env.HOME}/Development`,
                        category: 'development'
                    },
                    {
                        source: `${process.env.HOME}/Documents`,
                        category: 'documents'
                    }
                ],
                googleDrive: {
                    enabled: true,
                    basePath: `${process.env.HOME}/Library/CloudStorage/GoogleDrive-nick@aribia.llc/Shared drives`
                }
            },
            
            autoOrganize: {
                enabled: true,
                paths: [
                    `${process.env.HOME}/Downloads`,
                    `${process.env.HOME}/Desktop`
                ],
                rules: {
                    moveAfterDays: 7,
                    archiveAfterDays: 30,
                    deleteAfterDays: 90
                }
            },
            
            cleanup: {
                enabled: true,
                aggressive: false,
                schedule: '0 3 * * *', // Daily at 3 AM
                targets: [
                    {
                        path: `${process.env.HOME}/Library/Caches`,
                        maxAge: 7
                    },
                    {
                        path: `${process.env.HOME}/.cache`,
                        maxAge: 7
                    },
                    {
                        path: `${process.env.HOME}/Downloads`,
                        maxAge: 30
                    }
                ],
                maxCacheSize: 5 * 1024 * 1024 * 1024, // 5GB
                minFreeSpace: 10 * 1024 * 1024 * 1024 // 10GB
            },
            
            monitoring: {
                enabled: true,
                diskThreshold: 90, // Alert when disk usage > 90%
                checkInterval: 300000, // 5 minutes
                alerts: {
                    lowSpace: true,
                    syncErrors: true,
                    duplicates: true
                }
            },
            
            duplicates: {
                enabled: true,
                autoResolve: false,
                scanSchedule: '0 2 * * 0', // Weekly on Sunday at 2 AM
                minSize: 1024 * 1024, // 1MB minimum
                keepStrategy: 'newest' // 'newest', 'oldest', 'organized'
            },
            
            performance: {
                maxConcurrentOps: 2,
                queueTimeout: 30000,
                retryAttempts: 3,
                retryDelay: 5000
            }
        };
    }
    
    static async update(updates) {
        const current = await this.load();
        const updated = this.deepMerge(current, updates);
        await this.save(updated);
        return updated;
    }
    
    static deepMerge(target, source) {
        const result = { ...target };
        
        for (const key in source) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                result[key] = this.deepMerge(result[key] || {}, source[key]);
            } else {
                result[key] = source[key];
            }
        }
        
        return result;
    }
    
    static async validate(config) {
        const errors = [];
        
        // Validate paths exist
        const pathsToCheck = [
            ...config.watch.paths,
            ...config.backup.critical,
            ...config.autoOrganize.paths
        ];
        
        for (const pathToCheck of pathsToCheck) {
            try {
                await fs.access(pathToCheck);
            } catch (error) {
                errors.push(`Path does not exist: ${pathToCheck}`);
            }
        }
        
        // Validate port
        if (config.dashboard.port < 1024 || config.dashboard.port > 65535) {
            errors.push(`Invalid dashboard port: ${config.dashboard.port}`);
        }
        
        // Validate thresholds
        if (config.monitoring.diskThreshold < 0 || config.monitoring.diskThreshold > 100) {
            errors.push(`Invalid disk threshold: ${config.monitoring.diskThreshold}`);
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }
}

module.exports = ConfigManager;