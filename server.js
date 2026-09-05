const express = require('express');
const mqtt = require('mqtt');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Serve the frontend web files automatically!
app.use(express.static(path.join(__dirname, '../frontend')));

// Connect to MQTT broker
const brokerUrl = process.env.MQTT_BROKER_URL || 'mqtt://localhost';
const client = mqtt.connect(brokerUrl);

const db = require('./db');

// Logged-in sessions (token -> username)
const tokens = {};

// When MQTT connects
client.on('connect', () => {
    console.log("✅ Connected to MQTT");
    // Listen for data from any user's home
    client.subscribe('home/+/data');
    client.subscribe('home/+/device_data/+');
});

// Receive data from ESP / simulator
client.on('message', (topic, message) => {

    const parts = topic.split('/');
    if (parts.length === 3 && parts[0] === 'home' && parts[2] === 'data') {
        const username = parts[1];
        let [temp, gas] = message.toString().split(',');

        temp = parseFloat(temp);
        gas = parseInt(gas);

        db.get('SELECT temp_threshold, gas_threshold, email FROM users WHERE username = ?', [username], (err, row) => {
            if (err || !row) return;

            let status = (temp > row.temp_threshold || gas > row.gas_threshold) ? "Hazard" : "Normal";
            const timestamp = new Date().toLocaleString();

            // Hazard Notification System via Email (Simulated)
            if (status === "Hazard") {
                const alertMsg = `[HAZARD ALERT] Sent to: ${row.email || 'No Email Registered'} | User: ${username} | Temp: ${temp} | Gas: ${gas}`;
                console.log(`\x1b[31m${alertMsg}\x1b[0m`); // Log in Red
            }

            // Dynamically create and insert into history_<username>
            const tableName = `history_${username}`;
            db.run(`CREATE TABLE IF NOT EXISTS "${tableName}" (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                temp REAL NOT NULL,
                gas INTEGER NOT NULL,
                status TEXT NOT NULL
            )`, (err) => {
                if (!err) {
                    db.run(`INSERT INTO "${tableName}" (timestamp, temp, gas, status) VALUES (?, ?, ?, ?)`,
                        [timestamp, temp, gas, status], (err) => {
                            if (!err) {
                                console.log(`📡 Updated Sensor Data [${username}]:`, { temp, gas, status });
                            }
                        }
                    );
                }
            });
        });
    } else if (parts.length === 4 && parts[0] === 'home' && parts[2] === 'device_data') {
        const username = parts[1];
        const device = parts[3];
        const timestamp = new Date().toLocaleString();

        let power_usage = 0, temp = 0, gas = 0;
        try {
            const dataObj = JSON.parse(message.toString());
            power_usage = dataObj.power;
            temp = dataObj.temp;
            gas = dataObj.gas;
        } catch(e) {
            console.error("Invalid JSON from device", e);
            return;
        }

        // Dynamically create and insert into device_metrics_<username>
        const tableName = `device_metrics_${username}`;
        db.run(`CREATE TABLE IF NOT EXISTS "${tableName}" (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            device TEXT NOT NULL,
            power_usage REAL NOT NULL,
            temp REAL NOT NULL,
            gas INTEGER NOT NULL
        )`, (err) => {
            if (!err) {
                db.run(`INSERT INTO "${tableName}" (timestamp, device, power_usage, temp, gas) VALUES (?, ?, ?, ?, ?)`,
                    [timestamp, device, power_usage, temp, gas], (err) => {
                        if (!err) {
                            console.log(`⚡ Updated Device Data [${username}] -> ${device}: ${power_usage}W, ${temp}C, ${gas}ppm`);
                        }
                    }
                );
            }
        });
    }
});

// -------------------------------
// Authentication
// -------------------------------
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    db.get('SELECT * FROM users WHERE username = ? AND password = ?', [username, password], (err, row) => {
        if (row) {
            const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
            tokens[token] = username;
            res.json({ token });
        } else {
            res.status(401).json({ error: 'Invalid credentials' });
        }
    });
});

app.post('/api/signup', (req, res) => {
    const { username, password, email } = req.body;

    if (!username || !password || !email) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    db.get('SELECT username FROM users WHERE username = ?', [username], (err, row) => {
        if (row) {
            return res.status(400).json({ error: 'Username is already taken' });
        }

        db.run('INSERT INTO users (username, password, email) VALUES (?, ?, ?)', [username, password, email], function(err) {
            if (err) {
                return res.status(500).json({ error: 'Failed to create user' });
            }

            const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
            tokens[token] = username;
            
            // Default devices available in the dashboard
            const defaultDevices = [
                'lights', 'fan', 'tv', 
                'bedroom_lights', 'bedroom_fan', 'bedroom_ac', 
                'kitchen_lights', 'kitchen_fan', 'kitchen_microwave', 'kitchen_refrigerator'
            ];

            // 1. Broadcast initialization payload to MQTT so the simulator recognizes the system AND all features
            client.publish(`home/${username}/control/system`, 'OFF');
            defaultDevices.forEach(device => {
                client.publish(`home/${username}/control/${device}`, 'OFF');
            });

            // 2. Initialize device states in the Database
            const statesTable = `device_states_${username}`;
            db.run(`CREATE TABLE IF NOT EXISTS "${statesTable}" (
                device TEXT PRIMARY KEY,
                state TEXT NOT NULL
            )`, (err) => {
                if (!err) {
                    const stmt = db.prepare(`INSERT OR IGNORE INTO "${statesTable}" (device, state) VALUES (?, 'OFF')`);
                    defaultDevices.forEach(d => {
                        stmt.run(d);
                    });
                    stmt.finalize();
                }
            });

            res.json({ token });
        });
    });
});

function checkAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split(' ')[1];
    const username = tokens[token];

    if (username) {
        req.user = username;
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized' });
    }
}

// -------------------------------
// API: Get sensor data
// -------------------------------
app.get('/api/data', checkAuth, (req, res) => {
    const tableName = `history_${req.user}`;
    db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`, [tableName], (err, row) => {
        if (!row) return res.json({ temp: 0, gas: 0, status: 'Normal' });
        
        db.get(`SELECT temp, gas, status FROM "${tableName}" ORDER BY id DESC LIMIT 1`, [], (err, row) => {
            if (row) {
                res.json(row);
            } else {
                res.json({ temp: 0, gas: 0, status: 'Normal' });
            }
        });
    });
});

// -------------------------------
// API: Get history data
// -------------------------------
app.get('/api/history', checkAuth, (req, res) => {
    const tableName = `history_${req.user}`;
    db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`, [tableName], (err, row) => {
        if (!row) return res.json([]);
        
        db.all(`SELECT timestamp as time, temp, gas, status FROM (SELECT timestamp, temp, gas, status, id FROM "${tableName}" ORDER BY id DESC LIMIT 30) ORDER BY id ASC`, [], (err, rows) => {
            if (rows) {
                res.json(rows);
            } else {
                res.json([]);
            }
        });
    });
});

// -------------------------------
// API: Get Device History
// -------------------------------
app.get('/api/device_history', checkAuth, (req, res) => {
    const tableName = `device_metrics_${req.user}`;
    db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`, [tableName], (err, row) => {
        if (!row) return res.json([]);
        
        db.all(`SELECT timestamp, device, power_usage, temp, gas FROM "${tableName}" ORDER BY id DESC LIMIT 100`, [], (err, rows) => {
            if (rows) {
                res.json(rows);
            } else {
                res.json([]);
            }
        });
    });
});

// -------------------------------
// API: Settings
// -------------------------------
app.get('/api/settings', checkAuth, (req, res) => {
    db.get('SELECT temp_threshold, gas_threshold FROM users WHERE username = ?', [req.user], (err, row) => {
        if (row) res.json(row);
        else res.status(500).json({ error: 'Database error' });
    });
});

app.post('/api/settings', checkAuth, (req, res) => {
    const { temp_threshold, gas_threshold } = req.body;
    db.run('UPDATE users SET temp_threshold = ?, gas_threshold = ? WHERE username = ?', [temp_threshold, gas_threshold, req.user], function(err) {
        if (err) res.status(500).json({ error: 'Could not update settings' });
        else res.json({ success: true });
    });
});

// -------------------------------
// API: Control ON/OFF
// -------------------------------
app.get('/api/control/:state', checkAuth, (req, res) => {
    const state = req.params.state; // ON or OFF

    // Publish to the specific user's control topic
    client.publish(`home/${req.user}/control`, state);
    console.log(`🔘 Sent to ESP for [${req.user}]:`, state);

    res.json({ message: `System turned ${state}` });
});

// -------------------------------
// API: Control Specific Device ON/OFF
// -------------------------------
app.get('/api/control/:device/:state', checkAuth, (req, res) => {
    const { device, state } = req.params;

    // Publish to the specific user's specific device topic
    client.publish(`home/${req.user}/control/${device}`, state);
    console.log(`🔘 Sent to ESP for [${req.user}] -> ${device}:`, state);

    // Track state in DB
    const statesTable = `device_states_${req.user}`;
    db.run(`CREATE TABLE IF NOT EXISTS "${statesTable}" (
        device TEXT PRIMARY KEY,
        state TEXT NOT NULL
    )`, (err) => {
        if (!err) {
            db.run(`INSERT INTO "${statesTable}" (device, state) VALUES (?, ?) ON CONFLICT(device) DO UPDATE SET state = excluded.state`, [device, state]);
        }
    });

    res.json({ message: `${device} turned ${state}` });
});

// -------------------------------
// API: Get states and data for all devices
// -------------------------------
app.get('/api/devices', checkAuth, (req, res) => {
    const statesTable = `device_states_${req.user}`;
    const metricsTable = `device_metrics_${req.user}`;
    
    // We fetch current states
    db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`, [statesTable], (err, row) => {
        if (!row) return res.json({});
        
        db.all(`SELECT device, state FROM "${statesTable}"`, [], (err, stateRows) => {
            if (err || !stateRows) return res.json({});
            
            const result = {};
            stateRows.forEach(r => {
                result[r.device] = { state: r.state, data: null };
            });

            // Try fetching latest metric for each active device
            db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`, [metricsTable], (err, mRow) => {
                if (!mRow) return res.json(result);
                
                // Fetch the latest reading for each device
                // Group by device doesn't guarantee the latest in standard SQLite unless we do something complex, 
                // but a simple approach: fetch last 50 and update our objects with the latest ones found.
                db.all(`SELECT device, power_usage, temp, gas FROM "${metricsTable}" ORDER BY id ASC LIMIT 500`, [], (err, metrics) => {
                    if (metrics) {
                        metrics.forEach(m => {
                            if (result[m.device]) {
                                result[m.device].data = {
                                    power: m.power_usage,
                                    temp: m.temp,
                                    gas: m.gas
                                };
                            }
                        });
                    }
                    res.json(result);
                });
            });
        });
    });
});

// -------------------------------
// Start server
// -------------------------------
app.listen(3000, '0.0.0.0', () => {
    console.log("🚀 Server is running and listening on all network interfaces (Local Network Access Enabled) at port 3000.");
});
