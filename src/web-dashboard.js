const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const si = require('systeminformation');

class WebDashboard {
    constructor(daemon) {
        this.daemon = daemon;
        this.app = express();
        this.server = http.createServer(this.app);
        this.io = socketIO(this.server);
        this.setupRoutes();
        this.setupSocketIO();
        this.stats = {
            connections: 0,
            lastUpdate: Date.now()
        };
    }
    
    setupRoutes() {
        // Serve static files
        this.app.use(express.static(path.join(__dirname, '../web')));
        this.app.use(express.json());
        
        // API Routes
        this.app.get('/api/status', async (req, res) => {
            const status = await this.daemon.getStatus();
            res.json(status);
        });
        
        this.app.get('/api/stats', async (req, res) => {
            const stats = {
                daemon: this.daemon.stats,
                storage: await this.daemon.storageManager.getStorageStats(),
                sync: await this.daemon.syncEngine.getSyncStats(),
                system: await this.getSystemStats()
            };
            res.json(stats);
        });
        
        this.app.get('/api/config', async (req, res) => {
            res.json(this.daemon.config);
        });
        
        this.app.post('/api/config', async (req, res) => {
            try {
                const ConfigManager = require('./config-manager');
                const updated = await ConfigManager.update(req.body);
                this.daemon.config = updated;
                res.json({ success: true, config: updated });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        
        this.app.post('/api/control/:action', async (req, res) => {
            try {
                const { action } = req.params;
                let result;
                
                switch (action) {
                    case 'sync':
                        result = await this.daemon.performSync();
                        break;
                    case 'cleanup':
                        result = await this.daemon.performCleanup();
                        break;
                    case 'organize':
                        result = await this.daemon.performOrganization();
                        break;
                    case 'scan':
                        result = await this.daemon.performInitialScan();
                        break;
                    default:
                        throw new Error(`Unknown action: ${action}`);
                }
                
                res.json({ success: true, result });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        
        // Serve the dashboard HTML
        this.app.get('/', (req, res) => {
            res.send(this.getDashboardHTML());
        });
    }
    
    setupSocketIO() {
        this.io.on('connection', (socket) => {
            this.stats.connections++;
            console.log('Dashboard client connected');
            
            // Send initial data
            this.sendUpdate(socket);
            
            // Setup periodic updates
            const updateInterval = setInterval(() => {
                this.sendUpdate(socket);
            }, 5000);
            
            socket.on('disconnect', () => {
                this.stats.connections--;
                clearInterval(updateInterval);
                console.log('Dashboard client disconnected');
            });
            
            // Handle control commands
            socket.on('command', async (cmd, callback) => {
                try {
                    let result;
                    switch (cmd.type) {
                        case 'sync':
                            result = await this.daemon.performSync();
                            break;
                        case 'cleanup':
                            result = await this.daemon.performCleanup();
                            break;
                        case 'organize':
                            result = await this.daemon.performOrganization();
                            break;
                        default:
                            throw new Error(`Unknown command: ${cmd.type}`);
                    }
                    callback({ success: true, result });
                } catch (error) {
                    callback({ success: false, error: error.message });
                }
            });
        });
    }
    
    async sendUpdate(socket) {
        const update = {
            timestamp: Date.now(),
            status: await this.daemon.getStatus(),
            stats: {
                daemon: this.daemon.stats,
                storage: await this.daemon.storageManager.getStorageStats(),
                system: await this.getSystemStats()
            }
        };
        
        socket.emit('update', update);
    }
    
    async getSystemStats() {
        const [cpu, mem, disk] = await Promise.all([
            si.currentLoad(),
            si.mem(),
            si.fsSize()
        ]);
        
        return {
            cpu: cpu.currentLoad,
            memory: {
                used: mem.used,
                total: mem.total,
                percent: (mem.used / mem.total) * 100
            },
            disk: disk.map(d => ({
                mount: d.mount,
                size: d.size,
                used: d.used,
                percent: d.use
            }))
        };
    }
    
    updateHealth(health) {
        this.io.emit('health', health);
    }
    
    async start(port) {
        return new Promise((resolve) => {
            this.server.listen(port, () => {
                console.log(`Dashboard running on http://localhost:${port}`);
                resolve();
            });
        });
    }
    
    async stop() {
        return new Promise((resolve) => {
            this.server.close(() => {
                resolve();
            });
        });
    }
    
    getDashboardHTML() {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Storage Management Daemon Dashboard</title>
    <script src="/socket.io/socket.io.js"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #fff;
            min-height: 100vh;
            padding: 20px;
        }
        .container {
            max-width: 1400px;
            margin: 0 auto;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        .header h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
        }
        .status {
            display: inline-block;
            padding: 5px 15px;
            border-radius: 20px;
            background: rgba(255,255,255,0.2);
            margin: 5px;
        }
        .status.running { background: #4caf50; }
        .status.stopped { background: #f44336; }
        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .card {
            background: rgba(255,255,255,0.1);
            backdrop-filter: blur(10px);
            border-radius: 15px;
            padding: 20px;
            border: 1px solid rgba(255,255,255,0.2);
        }
        .card h2 {
            margin-bottom: 15px;
            font-size: 1.3em;
        }
        .stat {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid rgba(255,255,255,0.1);
        }
        .stat:last-child { border: none; }
        .progress {
            height: 20px;
            background: rgba(255,255,255,0.2);
            border-radius: 10px;
            overflow: hidden;
            margin: 10px 0;
        }
        .progress-bar {
            height: 100%;
            background: linear-gradient(90deg, #4caf50, #8bc34a);
            transition: width 0.3s;
        }
        .controls {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
            justify-content: center;
            margin: 30px 0;
        }
        button {
            padding: 12px 24px;
            border: none;
            border-radius: 8px;
            background: rgba(255,255,255,0.2);
            color: white;
            font-size: 1em;
            cursor: pointer;
            transition: all 0.3s;
        }
        button:hover {
            background: rgba(255,255,255,0.3);
            transform: translateY(-2px);
        }
        button:active {
            transform: translateY(0);
        }
        .log {
            background: rgba(0,0,0,0.3);
            padding: 15px;
            border-radius: 10px;
            font-family: 'Courier New', monospace;
            font-size: 0.9em;
            max-height: 200px;
            overflow-y: auto;
        }
        .log-entry {
            padding: 3px 0;
            opacity: 0.8;
        }
        .alert {
            background: #ff5722;
            padding: 10px 15px;
            border-radius: 8px;
            margin: 10px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Storage Management Daemon</h1>
            <div>
                <span class="status" id="daemon-status">Connecting...</span>
                <span class="status" id="uptime">Uptime: --</span>
            </div>
        </div>
        
        <div class="grid">
            <div class="card">
                <h2>📊 System Resources</h2>
                <div class="stat">
                    <span>CPU Usage</span>
                    <span id="cpu">--%</span>
                </div>
                <div class="progress">
                    <div class="progress-bar" id="cpu-bar" style="width: 0%"></div>
                </div>
                <div class="stat">
                    <span>Memory</span>
                    <span id="memory">--GB / --GB</span>
                </div>
                <div class="progress">
                    <div class="progress-bar" id="memory-bar" style="width: 0%"></div>
                </div>
                <div class="stat">
                    <span>Disk Usage</span>
                    <span id="disk">--%</span>
                </div>
                <div class="progress">
                    <div class="progress-bar" id="disk-bar" style="width: 0%"></div>
                </div>
            </div>
            
            <div class="card">
                <h2>📁 Storage Statistics</h2>
                <div class="stat">
                    <span>Files Processed</span>
                    <span id="files-processed">0</span>
                </div>
                <div class="stat">
                    <span>Space Freed</span>
                    <span id="space-freed">0 MB</span>
                </div>
                <div class="stat">
                    <span>Sync Operations</span>
                    <span id="sync-ops">0</span>
                </div>
                <div class="stat">
                    <span>Duplicates Found</span>
                    <span id="duplicates">0</span>
                </div>
                <div class="stat">
                    <span>Errors</span>
                    <span id="errors" style="color: #ff5722">0</span>
                </div>
            </div>
            
            <div class="card">
                <h2>☁️ Google Drive Status</h2>
                <div id="drive-status">
                    <div class="stat">Checking drives...</div>
                </div>
            </div>
        </div>
        
        <div class="controls">
            <button onclick="runCommand('sync')">🔄 Sync Now</button>
            <button onclick="runCommand('cleanup')">🧹 Clean Up</button>
            <button onclick="runCommand('organize')">📂 Organize Files</button>
            <button onclick="runCommand('scan')">🔍 Scan System</button>
            <button onclick="location.reload()">🔄 Refresh</button>
        </div>
        
        <div class="card">
            <h2>📜 Recent Activity</h2>
            <div class="log" id="activity-log">
                <div class="log-entry">Waiting for updates...</div>
            </div>
        </div>
    </div>
    
    <script>
        const socket = io();
        const logEntries = [];
        const maxLogEntries = 50;
        
        socket.on('connect', () => {
            document.getElementById('daemon-status').textContent = 'Connected';
            document.getElementById('daemon-status').className = 'status running';
            addLog('Connected to daemon');
        });
        
        socket.on('disconnect', () => {
            document.getElementById('daemon-status').textContent = 'Disconnected';
            document.getElementById('daemon-status').className = 'status stopped';
            addLog('Disconnected from daemon');
        });
        
        socket.on('update', (data) => {
            updateDashboard(data);
        });
        
        socket.on('health', (health) => {
            updateHealth(health);
        });
        
        function updateDashboard(data) {
            // Update uptime
            const uptime = formatUptime(data.status.uptime);
            document.getElementById('uptime').textContent = 'Uptime: ' + uptime;
            
            // Update system stats
            if (data.stats.system) {
                const sys = data.stats.system;
                
                // CPU
                document.getElementById('cpu').textContent = sys.cpu.toFixed(1) + '%';
                document.getElementById('cpu-bar').style.width = sys.cpu + '%';
                
                // Memory
                const memUsed = (sys.memory.used / 1073741824).toFixed(1);
                const memTotal = (sys.memory.total / 1073741824).toFixed(1);
                document.getElementById('memory').textContent = memUsed + 'GB / ' + memTotal + 'GB';
                document.getElementById('memory-bar').style.width = sys.memory.percent + '%';
                
                // Disk
                if (sys.disk[0]) {
                    document.getElementById('disk').textContent = sys.disk[0].percent.toFixed(1) + '%';
                    document.getElementById('disk-bar').style.width = sys.disk[0].percent + '%';
                }
            }
            
            // Update daemon stats
            if (data.stats.daemon) {
                const d = data.stats.daemon;
                document.getElementById('files-processed').textContent = d.filesProcessed;
                document.getElementById('space-freed').textContent = formatBytes(d.spaceFreed);
                document.getElementById('sync-ops').textContent = d.syncOperations;
                document.getElementById('errors').textContent = d.errors;
            }
            
            // Update storage stats
            if (data.stats.storage) {
                document.getElementById('duplicates').textContent = data.stats.storage.unresolvedDuplicates || 0;
            }
        }
        
        function updateHealth(health) {
            if (health.disk && health.disk[0] && health.disk[0].use > 90) {
                addLog('⚠️ Disk usage critical: ' + health.disk[0].use + '%');
            }
        }
        
        function runCommand(type) {
            addLog('Running ' + type + '...');
            socket.emit('command', { type }, (response) => {
                if (response.success) {
                    addLog('✅ ' + type + ' completed successfully');
                } else {
                    addLog('❌ ' + type + ' failed: ' + response.error);
                }
            });
        }
        
        function addLog(message) {
            const timestamp = new Date().toLocaleTimeString();
            logEntries.unshift(timestamp + ' - ' + message);
            if (logEntries.length > maxLogEntries) {
                logEntries.pop();
            }
            
            const logDiv = document.getElementById('activity-log');
            logDiv.innerHTML = logEntries.map(entry => 
                '<div class="log-entry">' + entry + '</div>'
            ).join('');
        }
        
        function formatUptime(ms) {
            const seconds = Math.floor(ms / 1000);
            const minutes = Math.floor(seconds / 60);
            const hours = Math.floor(minutes / 60);
            const days = Math.floor(hours / 24);
            
            if (days > 0) return days + 'd ' + (hours % 24) + 'h';
            if (hours > 0) return hours + 'h ' + (minutes % 60) + 'm';
            if (minutes > 0) return minutes + 'm ' + (seconds % 60) + 's';
            return seconds + 's';
        }
        
        function formatBytes(bytes) {
            const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
            if (bytes === 0) return '0 B';
            const i = Math.floor(Math.log(bytes) / Math.log(1024));
            return (bytes / Math.pow(1024, i)).toFixed(2) + ' ' + sizes[i];
        }
    </script>
</body>
</html>`;
    }
}

module.exports = WebDashboard;