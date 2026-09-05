const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err);
        return;
    }
    
    // Get all users
    db.all(`SELECT username FROM users`, [], (err, users) => {
        if (err || !users) return;

        const defaultDevices = [
            'lights', 'fan', 'tv', 
            'bedroom_lights', 'bedroom_fan', 'bedroom_ac', 
            'kitchen_lights', 'kitchen_fan', 'kitchen_microwave', 'kitchen_refrigerator'
        ];

        users.forEach(user => {
            const statesTable = `device_states_${user.username}`;
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
                    console.log(`Initialized table for ${user.username}`);
                } else {
                    console.error("Error creating table:", err);
                }
            });
        });
    });
});
