const fs = require('fs').promises;
const path = require('path');
const { EventEmitter } = require('events');
const crypto = require('crypto');

class IntelligentOrganizer extends EventEmitter {
    constructor(config) {
        super();
        this.config = config;
        this.rules = this.loadOrganizationRules();
        this.mlPatterns = new Map();
        this.initializePatterns();
    }
    
    loadOrganizationRules() {
        return {
            byType: {
                documents: ['.pdf', '.doc', '.docx', '.txt', '.rtf', '.odt'],
                images: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.webp'],
                videos: ['.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv'],
                audio: ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a'],
                archives: ['.zip', '.rar', '.tar', '.gz', '.7z', '.dmg'],
                code: ['.js', '.py', '.java', '.cpp', '.go', '.rs', '.swift', '.ts']
            },
            byContent: {
                legal: ['court', 'legal', 'lawsuit', 'agreement', 'contract', 'arias'],
                financial: ['invoice', 'receipt', 'tax', 'payment', 'bill', 'statement'],
                business: ['aribia', 'llc', 'business', 'company', 'corporate'],
                personal: ['resume', 'cv', 'personal', 'family', 'photo']
            },
            byDate: {
                recent: 7, // days
                current: 30,
                archive: 365
            }
        };
    }
    
    initializePatterns() {
        // Initialize ML-like patterns for intelligent categorization
        this.mlPatterns.set('project', /(?:project|repo|repository|src|source|code)/i);
        this.mlPatterns.set('backup', /(?:backup|bak|old|archive|copy)/i);
        this.mlPatterns.set('temp', /(?:temp|tmp|cache|trash)/i);
        this.mlPatterns.set('important', /(?:important|critical|urgent|priority)/i);
    }
    
    async organizeFile(filePath) {
        try {
            const stats = await fs.stat(filePath);
            const fileName = path.basename(filePath);
            const ext = path.extname(filePath).toLowerCase();
            
            // Determine category and destination
            const category = await this.categorizeFile(filePath, fileName, ext);
            const destination = await this.determineDestination(filePath, category, stats);
            
            // Check if file should be moved
            if (destination && destination !== path.dirname(filePath)) {
                await this.moveFile(filePath, destination);
                
                this.emit('file-organized', {
                    original: filePath,
                    destination,
                    category,
                    size: stats.size
                });
                
                return { moved: true, destination, category };
            }
            
            return { moved: false, reason: 'Already in correct location' };
            
        } catch (error) {
            this.emit('organize-error', { file: filePath, error });
            throw error;
        }
    }
    
    async categorizeFile(filePath, fileName, ext) {
        const categories = new Set();
        
        // Check by extension
        for (const [type, extensions] of Object.entries(this.rules.byType)) {
            if (extensions.includes(ext)) {
                categories.add(type);
            }
        }
        
        // Check by content patterns
        const lowerFileName = fileName.toLowerCase();
        for (const [category, patterns] of Object.entries(this.rules.byContent)) {
            if (patterns.some(pattern => lowerFileName.includes(pattern))) {
                categories.add(category);
            }
        }
        
        // Check ML patterns
        for (const [pattern, regex] of this.mlPatterns) {
            if (regex.test(filePath)) {
                categories.add(pattern);
            }
        }
        
        // Determine primary category based on priority
        const priorityOrder = ['legal', 'financial', 'business', 'important', 'project', 'documents', 'personal'];
        
        for (const priority of priorityOrder) {
            if (categories.has(priority)) {
                return priority;
            }
        }
        
        return Array.from(categories)[0] || 'general';
    }
    
    async determineDestination(filePath, category, stats) {
        const homeDir = process.env.HOME;
        const organized = path.join(homeDir, 'organized');
        
        // Determine time-based subfolder
        const ageInDays = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);
        let timeFolder = 'current';
        
        if (ageInDays < this.rules.byDate.recent) {
            timeFolder = 'recent';
        } else if (ageInDays > this.rules.byDate.archive) {
            timeFolder = 'archive';
        }
        
        // Build destination path
        const categoryMap = {
            legal: path.join(organized, 'Legal', timeFolder),
            financial: path.join(organized, 'Financial', timeFolder),
            business: path.join(organized, 'Business', timeFolder),
            documents: path.join(organized, 'Documents', timeFolder),
            images: path.join(organized, 'Media', 'Images', timeFolder),
            videos: path.join(organized, 'Media', 'Videos', timeFolder),
            audio: path.join(organized, 'Media', 'Audio', timeFolder),
            code: path.join(organized, 'Development', 'Code'),
            project: path.join(organized, 'Development', 'Projects'),
            personal: path.join(organized, 'Personal', timeFolder),
            general: path.join(organized, 'General', timeFolder)
        };
        
        return categoryMap[category] || path.join(organized, 'Uncategorized');
    }
    
    async moveFile(source, destinationDir) {
        await fs.mkdir(destinationDir, { recursive: true });
        
        const fileName = path.basename(source);
        let destination = path.join(destinationDir, fileName);
        
        // Handle naming conflicts
        let counter = 1;
        while (await this.fileExists(destination)) {
            const ext = path.extname(fileName);
            const base = path.basename(fileName, ext);
            destination = path.join(destinationDir, `${base}_${counter}${ext}`);
            counter++;
        }
        
        await fs.rename(source, destination);
        return destination;
    }
    
    async fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }
    
    async organizeAll() {
        const results = {
            processed: 0,
            moved: 0,
            errors: [],
            categories: {}
        };
        
        const scanPaths = this.config.autoOrganize.paths || [
            path.join(process.env.HOME, 'Downloads'),
            path.join(process.env.HOME, 'Desktop'),
            path.join(process.env.HOME, 'Documents')
        ];
        
        for (const scanPath of scanPaths) {
            try {
                await this.organizeDirectory(scanPath, results);
            } catch (error) {
                results.errors.push({ path: scanPath, error: error.message });
            }
        }
        
        return results;
    }
    
    async organizeDirectory(dirPath, results) {
        try {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);
                
                if (entry.isFile()) {
                    results.processed++;
                    
                    try {
                        const result = await this.organizeFile(fullPath);
                        if (result.moved) {
                            results.moved++;
                            results.categories[result.category] = 
                                (results.categories[result.category] || 0) + 1;
                        }
                    } catch (error) {
                        results.errors.push({ file: fullPath, error: error.message });
                    }
                }
            }
        } catch (error) {
            throw error;
        }
    }
    
    async resolveDuplicates(duplicateGroup) {
        const { hash, paths, size } = duplicateGroup;
        
        // Sort paths by priority (keep organized ones, remove from Downloads/temp)
        const priorityPaths = paths.sort((a, b) => {
            const scoreA = this.getPathPriority(a);
            const scoreB = this.getPathPriority(b);
            return scoreB - scoreA;
        });
        
        // Keep the highest priority file
        const keepPath = priorityPaths[0];
        const removePaths = priorityPaths.slice(1);
        
        // Create a backup reference file
        const backupRef = path.join(
            process.env.HOME,
            '.duplicate_backups',
            `${hash}.json`
        );
        
        await fs.mkdir(path.dirname(backupRef), { recursive: true });
        await fs.writeFile(backupRef, JSON.stringify({
            hash,
            kept: keepPath,
            removed: removePaths,
            size,
            date: new Date().toISOString()
        }, null, 2));
        
        // Remove duplicates
        for (const removePath of removePaths) {
            try {
                // Move to trash instead of deleting
                const trashPath = path.join(
                    process.env.HOME,
                    '.Trash',
                    `${path.basename(removePath)}.${Date.now()}`
                );
                await fs.rename(removePath, trashPath);
                
                this.emit('duplicate-resolved', {
                    kept: keepPath,
                    removed: removePath,
                    savedSpace: size
                });
            } catch (error) {
                console.error(`Failed to remove duplicate: ${removePath}`, error);
            }
        }
        
        return {
            resolved: true,
            kept: keepPath,
            removed: removePaths,
            spaceSaved: size * removePaths.length
        };
    }
    
    getPathPriority(filePath) {
        let score = 0;
        
        // Higher score for organized locations
        if (filePath.includes('/organized/')) score += 100;
        if (filePath.includes('/Documents/')) score += 80;
        if (filePath.includes('/Business/')) score += 70;
        if (filePath.includes('/Development/')) score += 60;
        
        // Lower score for temporary locations
        if (filePath.includes('/Downloads/')) score -= 50;
        if (filePath.includes('/tmp/') || filePath.includes('/temp/')) score -= 100;
        if (filePath.includes('/cache/')) score -= 80;
        
        // Bonus for cloud storage
        if (filePath.includes('/CloudStorage/')) score += 50;
        
        return score;
    }
    
    async smartCleanup(aggressive = false) {
        const cleaned = {
            files: 0,
            space: 0,
            categories: {}
        };
        
        // Define cleanup rules
        const cleanupRules = [
            {
                pattern: /\.(tmp|temp|cache)$/i,
                maxAge: aggressive ? 1 : 7, // days
                category: 'temporary'
            },
            {
                pattern: /\.(log)$/i,
                maxAge: aggressive ? 7 : 30,
                category: 'logs'
            },
            {
                pattern: /^\.DS_Store$/,
                maxAge: 0, // Always remove
                category: 'system'
            },
            {
                pattern: /\~$/,
                maxAge: aggressive ? 1 : 7,
                category: 'backup'
            }
        ];
        
        // Scan and clean
        const scanPaths = [
            process.env.HOME,
            '/tmp',
            '/var/tmp'
        ];
        
        for (const scanPath of scanPaths) {
            await this.cleanDirectory(scanPath, cleanupRules, cleaned, aggressive);
        }
        
        return cleaned;
    }
    
    async cleanDirectory(dirPath, rules, results, aggressive) {
        try {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);
                
                // Skip important directories
                if (entry.isDirectory()) {
                    const skipDirs = ['Library', '.git', 'node_modules', 'Applications'];
                    if (!skipDirs.includes(entry.name)) {
                        await this.cleanDirectory(fullPath, rules, results, aggressive);
                    }
                    continue;
                }
                
                // Check file against rules
                for (const rule of rules) {
                    if (rule.pattern.test(entry.name)) {
                        try {
                            const stats = await fs.stat(fullPath);
                            const ageInDays = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);
                            
                            if (ageInDays >= rule.maxAge) {
                                await fs.unlink(fullPath);
                                results.files++;
                                results.space += stats.size;
                                results.categories[rule.category] = 
                                    (results.categories[rule.category] || 0) + 1;
                            }
                        } catch (error) {
                            // Skip files we can't access
                        }
                        break;
                    }
                }
            }
        } catch (error) {
            // Skip directories we can't read
        }
    }
}

module.exports = IntelligentOrganizer;