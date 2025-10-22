#!/usr/bin/env node

/**
 * Post-install script for npm package
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

console.log('📦 Storage Management Daemon - Post Install Setup');

// Check platform compatibility
const platform = os.platform();
if (platform !== 'darwin' && platform !== 'linux') {
    console.warn(`⚠️  Platform ${platform} is not fully supported. Daemon may not work correctly.`);
}

// Make scripts executable
const scriptsToMakeExecutable = [
    'install.sh',
    'manage.sh', 
    'deploy-remote.sh',
    'bin/storage-daemon.js',
    'uninstall.sh'
];

scriptsToMakeExecutable.forEach(script => {
    const scriptPath = path.join(__dirname, '..', script);
    if (fs.existsSync(scriptPath)) {
        try {
            fs.chmodSync(scriptPath, 0o755);
            console.log(`✅ Made ${script} executable`);
        } catch (err) {
            console.error(`❌ Failed to make ${script} executable:`, err.message);
        }
    }
});

// Create necessary directories
const dirsToCreate = [
    path.join(os.homedir(), '.storage-daemon'),
    path.join(os.homedir(), 'organized')
];

dirsToCreate.forEach(dir => {
    try {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`📁 Created directory: ${dir}`);
        }
    } catch (err) {
        console.error(`❌ Failed to create directory ${dir}:`, err.message);
    }
});

console.log(`
🎉 Installation complete!

Next steps:
1. Run: storage-daemon install
2. Check status: storage-daemon status  
3. Open dashboard: storage-daemon dashboard

For help: storage-daemon --help
`);

process.exit(0);
